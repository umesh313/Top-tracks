import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const musicBrainzId = z.string().uuid();

type MusicBrainzArtistCredit = {
  artist?: { id?: string; name?: string; "sort-name"?: string };
  name?: string;
};

type MusicBrainzRelease = {
  date?: string;
  title?: string;
  "release-group"?: { id?: string; title?: string; "first-release-date"?: string };
};

type MusicBrainzRecording = {
  id?: string;
  title?: string;
  length?: number;
  isrcs?: string[];
  "artist-credit"?: MusicBrainzArtistCredit[];
  releases?: MusicBrainzRelease[];
};

async function assertAdmin(
  supabase: { rpc: (...args: never[]) => unknown },
  userId: string,
) {
  const { data } = await (supabase.rpc as unknown as (
    functionName: string,
    args: object,
  ) => Promise<{ data: boolean }>)("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (!data) throw new Error("Administrator access required");
}

const musicBrainzUserAgent =
  process.env["MUSICBRAINZ_USER_AGENT"]?.trim() ||
  "SONGBOARD/1.0 (catalog import; https://songsboard.example)";

function musicBrainzHeaders() {
  const token = process.env["MUSICBRAINZ_ACCESS_TOKEN"];
  if (!token) throw new Error("MusicBrainz access is not configured");

  return {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
    "User-Agent": musicBrainzUserAgent,
  };
}

/** MusicBrainz asks for no more than ~1 request/sec from ordinary clients. */
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch from the MusicBrainz Web Service with retry + exponential backoff.
 * The public API is heavily rate-limited and frequently answers 503 when busy,
 * so we retry a few times before surfacing an error to the admin UI.
 */
async function musicBrainzFetch<T>(path: string): Promise<T> {
  const maxAttempts = 4;
  let lastStatus = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1) await sleep(1000 * 2 ** (attempt - 2));
    const response = await fetch(`https://musicbrainz.org/ws/2/${path}`, {
      headers: musicBrainzHeaders(),
    });

    if (response.ok) return response.json() as Promise<T>;

    lastStatus = response.status;
    if (response.status === 401) throw new Error("MusicBrainz rejected the saved access token");
    if (response.status === 403) throw new Error("MusicBrainz blocked this request; check the User-Agent");
    // 429 (too many requests) and 503 (busy) are transient — retry with backoff.
    if (response.status === 429 || response.status === 503) continue;

    throw new Error(`MusicBrainz request failed (${response.status})`);
  }

  throw new Error(lastStatus === 503 ? "MusicBrainz is busy; try again shortly" : `MusicBrainz request failed (${lastStatus})`);
}

function artistName(recording: MusicBrainzRecording) {
  return recording["artist-credit"]?.map((credit) => credit.name ?? credit.artist?.name).filter(Boolean).join("") || "Unknown artist";
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70) || "recording";
}

function hueFromId(id: string) {
  let hash = 0;
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) % 360;
  return hash;
}

export const searchMusicBrainz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { query: string }) =>
    z.object({ query: z.string().trim().min(2).max(100) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const params = new URLSearchParams({
      query: data.query,
      fmt: "json",
      limit: "15",
    });
    const result = await musicBrainzFetch<{ recordings?: MusicBrainzRecording[] }>(
      `recording?${params.toString()}`,
    );

    return (result.recordings ?? []).flatMap((recording) => {
      if (!recording.id || !recording.title) return [];
      const artist = recording["artist-credit"]?.[0]?.artist;
      const release = recording.releases?.[0];
      return [{
        id: recording.id,
        title: recording.title,
        artist: artistName(recording),
        artistId: artist?.id ?? null,
        album: release?.["release-group"]?.title ?? release?.title ?? null,
        releaseDate: release?.["release-group"]?.["first-release-date"] ?? release?.date ?? null,
        durationSec: recording.length ? Math.round(recording.length / 1000) : null,
        isrc: recording.isrcs?.[0] ?? null,
      }];
    });
  });

export const importMusicBrainzRecordings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { recordingIds: string[] }) =>
    z.object({ recordingIds: z.array(musicBrainzId).min(1).max(25) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const db = context.supabase;
    let imported = 0;
    let updated = 0;

    for (let index = 0; index < data.recordingIds.length; index++) {
      const recordingId = data.recordingIds[index];
      if (index > 0) await sleep(1100); // respect MusicBrainz ~1 req/sec limit
      const recording = await musicBrainzFetch<MusicBrainzRecording>(
        `recording/${recordingId}?inc=artists+isrcs+releases+release-groups&fmt=json`,
      );
      const artist = recording["artist-credit"]?.[0]?.artist;
      if (!recording.id || !recording.title || !artist?.id || !artist.name) continue;

      const { data: existingArtist } = await db
        .from("artists")
        .select("id")
        .eq("musicbrainz_id", artist.id)
        .maybeSingle();
      let artistId = existingArtist?.id;
      if (!artistId) {
        const { data: createdArtist, error } = await db
          .from("artists")
          .insert({
            musicbrainz_id: artist.id,
            name: artist.name,
            slug: `${slugify(artist.name)}-${artist.id.slice(0, 8)}`,
            hue: hueFromId(artist.id),
          })
          .select("id")
          .single();
        if (error || !createdArtist) throw new Error(error?.message ?? "Could not import artist");
        artistId = createdArtist.id;
      }

      const release = recording.releases?.[0];
      const releaseGroup = release?.["release-group"];
      let albumId: string | null = null;
      if (releaseGroup?.id && (releaseGroup.title ?? release?.title)) {
        const { data: existingAlbum } = await db
          .from("albums")
          .select("id")
          .eq("musicbrainz_release_group_id", releaseGroup.id)
          .maybeSingle();
        albumId = existingAlbum?.id ?? null;
        if (!albumId) {
          const { data: createdAlbum, error } = await db
            .from("albums")
            .insert({
              artist_id: artistId,
              title: releaseGroup.title ?? release?.title ?? recording.title,
              release_date: normalizeDate(releaseGroup["first-release-date"] ?? release?.date),
              musicbrainz_release_group_id: releaseGroup.id,
            })
            .select("id")
            .single();
          if (error || !createdAlbum) throw new Error(error?.message ?? "Could not import album");
          albumId = createdAlbum.id;
        }
      }

      const songValues = {
        title: recording.title,
        artist_id: artistId,
        album_id: albumId,
        release_date: normalizeDate(releaseGroup?.["first-release-date"] ?? release?.date),
        duration_sec: recording.length ? Math.round(recording.length / 1000) : 200,
        isrc: recording.isrcs?.[0] ?? null,
        musicbrainz_recording_id: recording.id,
        hue: hueFromId(recording.id),
      };
      const { data: existingSong } = await db
        .from("songs")
        .select("id")
        .eq("musicbrainz_recording_id", recording.id)
        .maybeSingle();

      if (existingSong) {
        const { error } = await db.from("songs").update(songValues).eq("id", existingSong.id);
        if (error) throw new Error(error.message);
        updated += 1;
      } else {
        const { error } = await db.from("songs").insert({
          ...songValues,
          slug: `${slugify(recording.title)}-${recording.id.slice(0, 8)}`,
        });
        if (error) throw new Error(error.message);
        imported += 1;
      }
    }

    return { imported, updated, total: imported + updated };
  });

function normalizeDate(value?: string) {
  if (!value || !/^\d{4}(?:-\d{2})?(?:-\d{2})?$/.test(value)) return null;
  if (value.length === 4) return `${value}-01-01`;
  if (value.length === 7) return `${value}-01`;
  return value;
}