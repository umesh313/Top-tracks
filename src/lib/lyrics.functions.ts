import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Lyrics via LRCLIB (https://lrclib.net/docs). Public server fn: proxies the
// third-party request server-side and returns a normalized DTO to the browser.
// Never throws for a miss — returns not_found / instrumental instead.
const inputSchema = z.object({
  artist: z.string().min(1).max(200),
  track: z.string().min(1).max(200),
  album: z.string().max(200).optional(),
  duration: z.number().int().positive().max(7200).optional(),
});

export type LyricLine = { time: number | null; text: string };
export type LyricsResult =
  | { status: "synced" | "plain"; trackName: string; artistName: string; albumName: string | null; duration: number | null; source: "exact" | "search"; lines: LyricLine[] }
  | { status: "instrumental"; trackName: string; artistName: string }
  | { status: "not_found" };

type Record = { trackName?: string; artistName?: string; albumName?: string | null; duration?: number | null; instrumental?: boolean; plainLyrics?: string | null; syncedLyrics?: string | null };

const BASE = "https://lrclib.net/api";
const UA = process.env["LRCLIB_USER_AGENT"]?.trim() || "SONGBOARD/1.0 (lyrics viewer)";

async function api<T>(path: string): Promise<T | null> {
  const res = await fetch(`${BASE}${path}`, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

// Parse LRC "[mm:ss.xx] line" into timed lines. Drops metadata tags + empties.
export function parseLrc(lrc: string): LyricLine[] {
  const lines: LyricLine[] = [];
  for (const raw of lrc.split(/\r?\n/)) {
    const stamps = [...raw.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    const text = raw.replace(/\[.*?\]/g, "").trim();
    if (stamps.length === 0) continue;
    if (!text) continue;
    for (const m of stamps) {
      const frac = Number((m[3] ?? "0").padEnd(3, "0").slice(0, 3)) / 1000;
      lines.push({ time: Number(m[1]) * 60 + Number(m[2]) + frac, text });
    }
  }
  lines.sort((a, b) => (a.time ?? 0) - (b.time ?? 0));
  return lines;
}

function toResult(r: Record, source: "exact" | "search"): LyricsResult {
  const trackName = String(r.trackName ?? "");
  const artistName = String(r.artistName ?? "");
  if (r.instrumental) return { status: "instrumental", trackName, artistName };
  const synced = r.syncedLyrics?.trim();
  if (synced) {
    const lines = parseLrc(synced);
    if (lines.length > 0)
      return { status: "synced", trackName, artistName, albumName: r.albumName ?? null, duration: r.duration ?? null, source, lines };
  }
  const plain = r.plainLyrics?.trim();
  if (plain)
    return { status: "plain", trackName, artistName, albumName: r.albumName ?? null, duration: r.duration ?? null, source,
      lines: plain.split(/\r?\n/).map((t) => t.trim()).filter(Boolean).map((text) => ({ time: null as number | null, text })) };
  return { status: "not_found" };
}

function pickBest(records: Record[], duration?: number): Record | null {
  const withLyrics = records.filter((r) => r.instrumental || r.syncedLyrics?.trim() || r.plainLyrics?.trim());
  if (withLyrics.length === 0) return null;
  if (duration) {
    const near = withLyrics.filter((r) => r.duration != null && Math.abs(r.duration - duration) <= 10)
      .sort((a, b) => Math.abs((a.duration ?? 0) - duration) - Math.abs((b.duration ?? 0) - duration));
    if (near.length > 0) return near[0]!;
  }
  return withLyrics[0]!;
}

export const getLyrics = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data }): Promise<LyricsResult> => {
    try {
      if (data.album && data.duration) {
        const p = new URLSearchParams({ artist_name: data.artist, track_name: data.track, album_name: data.album, duration: String(Math.round(data.duration)) });
        const exact = await api<Record>(`/get?${p.toString()}`);
        if (exact) {
          const r = toResult(exact, "exact");
          if (r.status !== "not_found") return r;
        }
      }
      const attempts = [
        `/search?q=${encodeURIComponent(`${data.track} ${data.artist}`)}`,
        `/search?track_name=${encodeURIComponent(data.track)}&artist_name=${encodeURIComponent(data.artist)}`,
      ];
      for (const path of attempts) {
        const list = await api<Record[]>(path);
        if (!list?.length) continue;
        const best = pickBest(list, data.duration);
        if (best) return toResult(best, "search");
      }
      return { status: "not_found" };
    } catch (e) {
      console.error("[getLyrics]", e instanceof Error ? e.message : e);
      return { status: "not_found" };
    }
  });
