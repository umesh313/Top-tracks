import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeChart, DEFAULT_WEIGHTS, type RawMetrics, type Weights } from "./chart-engine";

type LastFmTrack = {
  name?: string;
  duration?: string | number;
  playcount?: string | number;
  listeners?: string | number;
  mbid?: string | null;
  image?: { "#text"?: string; size?: string }[];
  artist?: { name?: string; mbid?: string | null };
};


function lastFmKey(): string {
  const key = process.env["LASTFM_API_KEY"] ?? import.meta.env?.["VITE_LASTFM_API_KEY"];
  if (!key) throw new Error("Last.fm is not configured (set LASTFM_API_KEY in .env / .env.local)");
  return key;
}

async function assertAdmin(
  supabase: { rpc: (...args: never[]) => unknown },
  userId: string,
) {
  const { data } = await (supabase.rpc as unknown as (
    functionName: string,
    args: object,
  ) => Promise<{ data: boolean }>)("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Administrator access required");
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70) || "track";
}

function hueFromId(id: string) {
  let hash = 0;
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) % 360;
  return hash;
}

type Img = { "#text"?: string; size?: string };
const PLACEHOLDER_FP = "2a96cbd8b46e442fc41c2b86b821562";

/** Best available non-placeholder artwork URL from a Last.fm image array (or null). */
function pickImage(images: Img[] | undefined): string | null {
  if (!images?.length) return null;
  for (const s of ["extralarge", "large", "medium", "small"]) {
    const f = images.find((i) => i.size === s && i["#text"] && !i["#text"]!.includes(PLACEHOLDER_FP));
    if (f?.["#text"]) return f["#text"]!;
  }
  return null;
}

/**
 * Curated list of well-known real artists. We source each artist's actual top
 * tracks from Last.fm ("artist.gettoptracks") instead of the global chart,
 * because the global chart is flooded with auto-generated/bot tracks (often
 * misattributed to real artists like "Taylor Swift - Patient Zero"). This keeps
 * every imported song real.
 */
const CURATED_ARTISTS: string[] = (() => {
  const fromEnv = (process.env["LIVE_ARTIST_LIMIT"] ?? import.meta.env?.["VITE_LIVE_ARTIST_LIMIT"]) as string | undefined;
  const full = [
  "Taylor Swift", "Olivia Rodrigo", "Billie Eilish", "Sabrina Carpenter", "Chappell Roan",
  "Charli XCX", "Beyoncé", "Ariana Grande", "Drake", "The Weeknd", "Kendrick Lamar",
  "Travis Scott", "Post Malone", "Eminem", "Ed Sheeran", "Dua Lipa", "Harry Styles",
  "Adele", "Rihanna", "Lady Gaga", "Bruno Mars", "Bad Bunny", "Karol G", "Rosalía",
  "Rauw Alejandro", "Peso Pluma", "Feid", "Anuel AA", "Coldplay", "Imagine Dragons",
  "Arctic Monkeys", "Future", "21 Savage", "Lil Baby", "Gunna", "Playboi Carti",
  "Don Toliver", "SZA", "Doja Cat", "Nicki Minaj", "Megan Thee Stallion", "J. Cole",
  "Tyler, The Creator", "Tame Impala", "Glass Animals", "The 1975", "Sam Smith",
  "Miley Cyrus", "Justin Bieber", "Maroon 5", "Linkin Park", "Queen", "The Beatles",
  "Michael Jackson", "ABBA", "Fleetwood Mac", "Radiohead", "Nirvana", "David Bowie",
  "Kanye West", "Metro Boomin", "Jack Harlow", "Benson Boone", "Gracie Abrams", "Noah Kahan",
  ];
  const limit = Number(fromEnv ?? "") || full.length;
  return full.slice(0, Math.max(1, Math.min(full.length, limit)));
})();

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// In-memory cache: one page load used to cost ~60 Last.fm calls. Cache live
// tracks for 10 minutes so dev SSR stays fast and under rate limits.
let liveTracksCache: { at: number; tracks: LastFmTrack[] } | null = null;
const LIVE_TTL_MS = 10 * 60 * 1000;

/** Fetch with a timeout so a hung Last.fm call can't hang SSR forever. */
async function fetchWithTimeout(url: string, ms = 12_000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// --- Artwork helpers (server-side, cached; never throw) ---------------------

/**
 * Real artist photo from Deezer (keyless). Only returns a photo when the top
 * result plausibly matches the requested artist name.
 */
export async function deezerArtistImage(name: string): Promise<string | null> {
  try {
    const r = await fetchWithTimeout(`https://api.deezer.com/search/artist?q=${encodeURIComponent(name)}&limit=1`, 8000);
    if (!r.ok) return null;
    const j = (await r.json()) as { data?: { name?: string; picture_big?: string; picture_medium?: string }[] };
    const first = j.data?.[0];
    const pic = first?.picture_big ?? first?.picture_medium;
    if (!pic) return null;
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const a = norm(first?.name ?? "");
    const b = norm(name);
    if (a && b && a !== b && !a.includes(b) && !b.includes(a)) return null; // avoid a different artist
    return pic;
  } catch { return null; }
}

const artistImageCache = new Map<string, { at: number; url: string | null }>();
const ARTIST_IMG_TTL = 60 * 60 * 1000;

/**
 * Artist photo for chart artist pages: Last.fm artist.getInfo first, iTunes
 * artwork fallback. Best-effort (never throws), cached for an hour.
 */
export async function fetchArtistImage(name: string): Promise<string | null> {
  const ck = name.trim().toLowerCase();
  const hit = artistImageCache.get(ck);
  if (hit && Date.now() - hit.at < ARTIST_IMG_TTL) return hit.url;
  let url: string | null = null;
  try {
    const p = new URLSearchParams({ method: "artist.getinfo", artist: name, api_key: lastFmKey(), format: "json", autocorrect: "1" });
    const r = await fetchWithTimeout(`https://ws.audioscrobbler.com/2.0/?${p}`, 8000);
    if (r.ok) {
      const j = (await r.json()) as { artist?: { image?: Img[] } };
      url = pickImage(j.artist?.image);
    }
  } catch { /* best-effort */ }
  if (!url) url = await deezerArtistImage(name);
  if (!url) {
    try {
      const r = await fetchWithTimeout(`https://itunes.apple.com/search?term=${encodeURIComponent(name)}&entity=musicArtist&limit=1`, 8000);
      if (r.ok) {
        const j = (await r.json()) as { results?: { artworkUrl100?: string }[] };
        url = j.results?.[0]?.artworkUrl100?.replace("100x100bb", "600x600bb") ?? null;
      }
    } catch { /* ignore */ }
  }
  artistImageCache.set(ck, { at: Date.now(), url });
  if (artistImageCache.size > 300) artistImageCache.delete(artistImageCache.keys().next().value!);
  return url;
}

const trackCoverCache = new Map<string, { at: number; url: string | null }>();
const TRACK_COVER_TTL = 60 * 60 * 1000;

/** Album cover for one track (Last.fm track.getInfo), cached for an hour. Best-effort. */
export async function fetchTrackCover(artist: string, track: string): Promise<string | null> {
  const ck = `${artist.trim().toLowerCase()}::${track.trim().toLowerCase()}`;
  const hit = trackCoverCache.get(ck);
  if (hit && Date.now() - hit.at < TRACK_COVER_TTL) return hit.url;
  let url: string | null = null;
  try {
    const p = new URLSearchParams({ method: "track.getInfo", artist, track, api_key: lastFmKey(), format: "json", autocorrect: "1" });
    const r = await fetchWithTimeout(`https://ws.audioscrobbler.com/2.0/?${p}`, 8000);
    if (r.ok) {
      const j = (await r.json()) as { track?: { album?: { image?: Img[] } } };
      url = pickImage(j.track?.album?.image);
    }
  } catch { /* best-effort */ }
  if (!url) {
    // Last.fm album art is placeholder-only these days — fall back to iTunes.
    try {
      const r = await fetchWithTimeout(`https://itunes.apple.com/search?term=${encodeURIComponent(`${track} ${artist}`)}&entity=song&limit=1`, 8000);
      if (r.ok) {
        const j = (await r.json()) as { results?: { artworkUrl100?: string }[] };
        url = j.results?.[0]?.artworkUrl100?.replace("100x100bb", "600x600bb") ?? null;
      }
    } catch { /* ignore */ }
  }
  trackCoverCache.set(ck, { at: Date.now(), url });
  if (trackCoverCache.size > 500) trackCoverCache.delete(trackCoverCache.keys().next().value!);
  return url;
}

/** Fetch a real artist's actual most-played tracks from Last.fm. */
async function fetchArtistTopTracks(artist: string, limit: number): Promise<LastFmTrack[]> {
  const params = new URLSearchParams({
    method: "artist.gettoptracks",
    artist,
    api_key: lastFmKey(),
    format: "json",
    autocorrect: "1",
    limit: String(limit),
  });
  const res = await fetchWithTimeout(`https://ws.audioscrobbler.com/2.0/?${params.toString()}`);
  if (!res.ok) throw new Error(`Last.fm request failed (${res.status})`);
  const json = (await res.json()) as { toptracks?: { track?: LastFmTrack[] } };
  return json.toptracks?.track ?? [];
}

/** Gather real top tracks for every curated artist, throttled to ~4 req/sec.
 *  One failing artist never fails the whole chart. Results are cached in
 *  memory for 10 minutes so SSR doesn't hammer Last.fm on every request. */
async function fetchAllCuratedTracks(): Promise<LastFmTrack[]> {
  if (liveTracksCache && Date.now() - liveTracksCache.at < LIVE_TTL_MS) {
    return liveTracksCache.tracks;
  }
  const out: LastFmTrack[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < CURATED_ARTISTS.length; i += 8) {
    const batch = CURATED_ARTISTS.slice(i, i + 8);
    const settled = await Promise.allSettled(batch.map((a) => fetchArtistTopTracks(a, 4)));
    for (const r of settled) {
      if (r.status !== "fulfilled") {
        console.warn("[lastfm] artist fetch failed:", r.reason instanceof Error ? r.reason.message : r.reason);
        continue;
      }
      for (const t of r.value) {
      const title = t.name?.trim();
      const artistName = t.artist?.name?.trim();
      if (!title || !artistName) continue;
      const key = `${artistName.toLowerCase()}::${title.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(t);
      }
    }
    if (i + 8 < CURATED_ARTISTS.length) await sleep(120);
  }
  if (!out.length) {
    if (liveTracksCache) return liveTracksCache.tracks;
    throw new Error("Last.fm returned no tracks (rate-limited or offline?)");
  }
  liveTracksCache = { at: Date.now(), tracks: out };
  return out;
}

type RealSeedResult = {
  imported: number;
  weekId: number;
  weekStart: string;
  entries: number;
};

async function adminDb() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

/**
 * Core seed: pulls curated real artists' top tracks from Last.fm and builds the
 * songs/artists catalog plus one chart week with real metrics.
 */
async function buildRealCatalog(): Promise<RealSeedResult> {
  const db = await adminDb();
  const tracks = await fetchAllCuratedTracks();
  const artistIds = new Map<string, string>();
  const artistRows = new Map<string, { name: string; listeners: number; mbid?: string | undefined }>();

  for (const t of tracks) {
    const name = t.artist?.name;
    if (!name) continue;
    const cur = artistRows.get(name);
    const listeners = Number(t.listeners ?? 0);
    if (!cur || listeners > cur.listeners) {
      artistRows.set(name, { name, listeners, mbid: t.artist?.mbid ?? undefined });
    }
  }

  for (const a of artistRows.values()) {
    const key = a.name.toLowerCase();
    const slug = `${slugify(a.name)}-${hueFromId(a.name)}`;
    const { data, error } = await db.from("artists").insert({
      slug,
      name: a.name,
      hue: hueFromId(a.name),
      bio: "Imported from Last.fm real chart data.",
      monthly_listeners: a.listeners,
      musicbrainz_id: a.mbid ?? null,
    }).select("id").single();
    if (error || !data) throw new Error(error?.message ?? "Could not insert artist");
    artistIds.set(key, data.id);
  }

  const songs: { id: string; title: string }[] = [];
  const seen = new Set<string>();
  for (const t of tracks) {
    const title = t.name?.trim();
    const artistName = t.artist?.name?.trim();
    if (!title || !artistName) continue;
    const artistId = artistIds.get(artistName.toLowerCase());
    if (!artistId) continue;
    const key = `${artistName.toLowerCase()}::${title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const slug = `${slugify(title)}-${slugify(artistName)}-${hueFromId(title)}`;
    const hue = hueFromId(title);
    const { data, error } = await db.from("songs").insert({
      slug,
      title,
      artist_id: artistId,
      duration_sec: Number(t.duration) > 0 ? Number(t.duration) : 200,
      hue,
      isrc: null,
      musicbrainz_recording_id: t.mbid ?? null,
    }).select("id").single();
    if (error || !data) throw new Error(error?.message ?? "Could not insert song");
    songs.push({ id: data.id, title });
  }
  if (songs.length === 0) throw new Error("No songs could be imported from Last.fm");

  // Real metrics per song, aligned to the order of `songs`.
  const allTracks: LastFmTrack[] = [];
  {
    const used = new Set<string>();
    for (const t of tracks) {
      const title = t.name?.trim();
      const artistName = t.artist?.name?.trim();
      if (!title || !artistName) continue;
      const key = `${artistName.toLowerCase()}::${title.toLowerCase()}`;
      if (used.has(key)) continue;
      used.add(key);
      allTracks.push(t);
    }
  }

  const metrics: RawMetrics[] = songs.map((s, i) => {
    const t = allTracks[i];
    const playcount = Number(t?.playcount ?? 0);
    const listeners = Number(t?.listeners ?? 0);
    return {
      songId: s.id,
      streaming: playcount,
      radio: listeners,
      social: Math.round((playcount / Math.max(1, listeners)) * 100),
      search: Math.round(Math.sqrt(playcount * listeners) / 100),
      peopleUp: 0,
      peopleDown: 0,
    };
  });

  const { data: cfg } = await db.from("scoring_config").select("*").eq("id", 1).single();
  const weights: Weights = cfg ? {
    streaming: Number(cfg.streaming), radio: Number(cfg.radio), people: Number(cfg.people),
    social: Number(cfg.social), search: Number(cfg.search),
  } : DEFAULT_WEIGHTS;

  const weekStart = new Date();
  const day = (weekStart.getUTCDay() + 6) % 7;
  weekStart.setUTCDate(weekStart.getUTCDate() - day);
  const ws = weekStart.toISOString().slice(0, 10);

  const { data: week, error: weekError } = await db.from("chart_weeks").insert({ week_start: ws }).select().single();
  if (weekError || !week) throw new Error(weekError?.message ?? "Could not insert chart week");

  const entries = computeChart(metrics, new Map(), weights, 100);

  const { error: mError } = await db.from("song_metrics").insert(metrics.map((m) => ({
    song_id: m.songId, week_id: week.id,
    streaming: m.streaming, radio: m.radio, social: m.social, search: m.search,
    people_up: m.peopleUp, people_down: m.peopleDown,
  })));
  if (mError) throw new Error(mError.message);

  const { error: eError } = await db.from("chart_entries").insert(entries.map((e) => ({
    week_id: week.id, song_id: e.songId, rank: e.rank, prev_rank: e.prevRank, peak_rank: e.peakRank,
    weeks_on_chart: e.weeksOnChart, songboard_score: e.songboardScore, chart_score: e.chartScore,
    people_score: e.peopleScore, momentum_score: e.momentumScore, streaming_score: e.streamingScore,
    radio_score: e.radioScore, social_score: e.socialScore, search_score: e.searchScore,
  })));
  if (eError) throw new Error(eError.message);

  return { imported: songs.length, weekId: week.id, weekStart: ws, entries: entries.length };
}

/** Heuristic tags so genre/country pages show real songs.
 *  Live Last.fm rows carry no genre/country metadata — derive from the
 *  artist roster (zero extra API calls, cached with the chart). */
const ARTIST_GENRE: [RegExp, string][] = [
  [/(bad bunny|karol g|peso pluma|feid|rauw alejandro|anuel|rosal|shakira|j balvin)/, "latin"],
  [/(drake|kendrick|travis scott|eminem|21 savage|future|lil baby|gunna|playboi carti|don toliver|nicki minaj|megan|j\.?\s*cole|tyler|kanye|metro boomin|jack harlow|doja cat)/, "hip-hop"],
  [/(taylor swift|olivia rodrigo|sabrina carpenter|chappell roan|charli xcx|ariana grande|dua lipa|harry styles|adele|rihanna|lady gaga|miley cyrus|justin bieber|maroon 5|benson boone|gracie abrams|noah kahan|sam smith|billie eilish|sza)/, "pop"],
  [/(weeknd|beyonc|bruno mars|post malone|ed sheeran|coldplay|imagine dragons|arctic monkeys|tame impala|glass animals|1975)/, "pop"],
  [/(queen|beatles|linkin park|nirvana|radiohead|fleetwood mac|abba|michael jackson|david bowie)/, "rock"],
];
const ARTIST_COUNTRY: [RegExp, string][] = [
  [/(bad bunny|rauw alejandro|anuel)/, "PR"],
  [/(karol g|feid|j balvin|shakira)/, "CO"],
  [/(peso pluma)/, "MX"],
  [/(rosal)/, "ES"],
  [/(beatles|ed sheeran|harry styles|adele|coldplay|arctic monkeys|dua lipa|sam smith)/, "GB"],
  [/(weeknd|drake|justin bieber)/, "CA"],
  [/(rihanna)/, "BB"],
  [/(abba)/, "SE"],
  [/(bts|blackpink|stray kids|newjeans)/, "KR"],
];
function tagGenre(artist: string): string | null {
  const a = artist.toLowerCase();
  for (const [re, g] of ARTIST_GENRE) if (re.test(a)) return g;
  return null;
}
function tagCountry(artist: string): string | null {
  const a = artist.toLowerCase();
  for (const [re, c] of ARTIST_COUNTRY) if (re.test(a)) return c;
  // Default large US roster
  if (/(taylor swift|olivia rodrigo|billie eilish|sabrina carpenter|beyonc|ariana grande|kendrick|travis scott|post malone|eminem|sza|doja cat|nicki minaj|miley cyrus|lady gaga|bruno mars|maroon 5|imagine dragons|linkin park|michael jackson|kanye|tyler|chappell|charli|gracie|noah kahan|benson boone|jack harlow|metro boomin|tame impala|glass animals|1975)/.test(a)) return "US";
  return null;
}

/** Live-first chart: fetch real Last.fm tracks and rank them in memory.
 *  No database, no service-role key, no seeding — pure Last.fm → ChartRow.
 *  Throws when Last.fm is unavailable so callers can show an explicit
 *  empty/error state instead of fake data. */
type LiveTrack = { artistName: string; trackName: string; playcount: number; listeners: number; duration: number; mbid: string; image: string | null };

export async function fetchLiveChartRows(limit = 100): Promise<LiveChartRow[]> {
  const rawTracks = await fetchAllCuratedTracks();
  const tracks: LiveTrack[] = [];
  for (const t of rawTracks) {
    const trackName = (t.name ?? "").trim();
    const artistName = (t.artist?.name ?? "").trim();
    if (!trackName || !artistName) continue;
    tracks.push({
      artistName,
      trackName,
      playcount: Number(t.playcount ?? 0) || 0,
      listeners: Number(t.listeners ?? 0) || 0,
      duration: Number(t.duration ?? 210) || 210,
      mbid: String(t.mbid ?? ""),
      image: pickImage(t.image),
    });
  }
  const seen = new Set<string>();
  const unique: LiveTrack[] = [];
  for (const t of tracks) {
    const key = `${t.artistName.toLowerCase()}::${t.trackName.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(t);
  }
  unique.sort((a, b) => b.listeners - a.listeners);
  const top = unique.slice(0, limit);

  const raw: RawMetrics[] = top.map((t) => {
    const id = t.mbid || `${t.artistName}::${t.trackName}`;
    return {
      songId: id,
      streaming: t.playcount,
      radio: Math.round(t.listeners * 2 + t.playcount * 0.3),
      social: Math.round(t.listeners * 1.2 + t.playcount * 0.2),
      search: Math.round(t.listeners * 0.7 + t.playcount * 0.06),
      peopleUp: Math.round(t.listeners / 800 + t.playcount / 8000),
      peopleDown: 0,
    };
  });
  const computed = computeChart(raw, new Map(), DEFAULT_WEIGHTS, limit);
  const byId = new Map(top.map((t) => [t.mbid || `${t.artistName}::${t.trackName}`, t]));

  return computed.map((e) => {
    const t = byId.get(e.songId)!;
    const artistSlug = slugify(t.artistName);
    const songSlug = `${slugify(t.artistName)}-${slugify(t.trackName)}`.slice(0, 90);
    const hue = hueFromId(`${t.artistName}-${t.trackName}`);
    return {
      rank: e.rank,
      prev_rank: null,
      peak_rank: e.rank,
      weeks_on_chart: 1,
      songboard_score: e.songboardScore,
      chart_score: e.chartScore,
      people_score: e.peopleScore,
      momentum_score: e.momentumScore,
      streaming_score: e.streamingScore,
      radio_score: e.radioScore,
      social_score: e.socialScore,
      search_score: e.searchScore,
      song: {
        id: e.songId,
        slug: songSlug,
        title: t.trackName,
        hue,
        image: t.image,
        genre_id: tagGenre(t.artistName),
        country_code: tagCountry(t.artistName),
        release_date: null,
        duration_sec: t.duration,
        artist: { id: artistSlug, slug: artistSlug, name: t.artistName, hue: hueFromId(t.artistName) },
      },
    };
  });
}

export type LiveChartRow = {
  rank: number; prev_rank: null; peak_rank: number; weeks_on_chart: number;
  songboard_score: number; chart_score: number; people_score: number; momentum_score: number;
  streaming_score: number; radio_score: number; social_score: number; search_score: number;
  song: { id: string; slug: string; title: string; hue: number; image: string | null; genre_id: string | null; country_code: string | null; release_date: null; duration_sec: number;
    artist: { id: string; slug: string; name: string; hue: number } };
};

/** Live Last.fm search (tracks + artists). No database involved. */
export async function searchLiveCatalog(q: string): Promise<{
  songs: (LiveChartRow["song"] & { playcount: number; listeners: number })[];
  artists: { id: string; slug: string; name: string; hue: number; image: string | null; listeners: number }[];
}> {
  const key = lastFmKey();
  const query = q.trim().slice(0, 80);
  if (query.length < 2) return { songs: [], artists: [] };
  const [trackRes, artistRes] = await Promise.all([
    fetchWithTimeout(`https://ws.audioscrobbler.com/2.0/?${new URLSearchParams({ method: "track.search", track: query, api_key: key, format: "json", limit: "12" })}`),
    fetchWithTimeout(`https://ws.audioscrobbler.com/2.0/?${new URLSearchParams({ method: "artist.search", artist: query, api_key: key, format: "json", limit: "8" })}`),
  ]);
  if (!trackRes.ok) throw new Error(`Last.fm song search failed (${trackRes.status})`);
  if (!artistRes.ok) throw new Error(`Last.fm artist search failed (${artistRes.status})`);
  const trackJson = (await trackRes.json()) as {
    error?: number;
    message?: string;
    results?: { trackmatches?: { track?: { name?: string; artist?: string; mbid?: string; image?: Img[]; playcount?: string; listeners?: string }[] } };
  };
  const artistJson = (await artistRes.json()) as {
    error?: number;
    message?: string;
    results?: { artistmatches?: { artist?: { name?: string; mbid?: string; image?: Img[]; listeners?: string }[] } };
  };
  if (trackJson.error) throw new Error(`Last.fm song search failed: ${trackJson.message ?? "Unknown error"}`);
  if (artistJson.error) throw new Error(`Last.fm artist search failed: ${artistJson.message ?? "Unknown error"}`);
  const songs: (LiveChartRow["song"] & { playcount: number; listeners: number })[] = [];
  for (const t of trackJson.results?.trackmatches?.track ?? []) {
    const title = String(t.name ?? "").trim();
    const artist = String(t.artist ?? "").trim();
    if (!title || !artist) continue;
    const hue = hueFromId(`${artist}-${title}`);
    songs.push({
      id: String(t.mbid || `${artist}::${title}`),
      slug: `${slugify(artist)}-${slugify(title)}`.slice(0, 90),
      title,
      hue,
      image: pickImage(t.image),
      genre_id: null,
      country_code: null,
      release_date: null,
      duration_sec: 210,
      playcount: Number(t.playcount ?? 0) || 0,
      listeners: Number(t.listeners ?? 0) || 0,
      artist: { id: slugify(artist), slug: slugify(artist), name: artist, hue: hueFromId(artist) },
    });
  }
  const artists: { id: string; slug: string; name: string; hue: number; image: string | null; listeners: number }[] = [];
  for (const a of artistJson.results?.artistmatches?.artist ?? []) {
    const name = String(a.name ?? "").trim();
    if (!name) continue;
    artists.push({
      id: String(a.mbid || slugify(name)),
      slug: slugify(name),
      name,
      hue: hueFromId(name),
      image: pickImage(a.image),
      listeners: Number(a.listeners ?? 0) || 0,
    });
  }
  return { songs, artists };
}

let seedingPromise: Promise<RealSeedResult> | null = null;
let lastSeedAttemptAt = 0;
const SEED_COOLDOWN_MS = 60_000;

type AdminDb = Awaited<ReturnType<typeof adminDb>>;

/** A catalog counts as "real" if it has any MusicBrainz-identified artist or song. */
async function isRealCatalog(db: AdminDb): Promise<boolean> {
  const { count: realArtists } = await db
    .from("artists").select("id", { count: "exact", head: true }).not("musicbrainz_id", "is", null);
  const { count: realSongs } = await db
    .from("songs").select("id", { count: "exact", head: true }).not("musicbrainz_recording_id", "is", null);
  return (realArtists ?? 0) > 0 || (realSongs ?? 0) > 0;
}

/** Remove all catalog + chart data in foreign-key-safe order. */
async function wipeCatalog(db: AdminDb): Promise<void> {
  const zeroUuid = "00000000-0000-0000-0000-000000000000";
  await db.from("chart_entries").delete().neq("week_id", -1);
  await db.from("song_metrics").delete().neq("week_id", -1);
  await db.from("votes").delete().neq("id", zeroUuid);
  await db.from("battle_votes").delete().neq("battle_id", zeroUuid);
  await db.from("follows").delete().neq("target_type", "__none__");
  await db.from("predictions").delete().neq("id", zeroUuid);
  await db.from("battles").delete().neq("id", zeroUuid);
  await db.from("chart_weeks").delete().neq("id", -1);
  await db.from("songs").delete().neq("id", zeroUuid);
  await db.from("albums").delete().neq("id", zeroUuid);
  await db.from("artists").delete().neq("id", zeroUuid);
}

/** Wipe any existing (fake) catalog and seed real Last.fm data. */
async function reseedCatalog(): Promise<RealSeedResult> {
  const db = await adminDb();
  await wipeCatalog(db);
  return buildRealCatalog();
}

/**
 * Public, no sign-in required: guarantees the DB holds REAL Last.fm data.
 * If the catalog is empty OR is still the seeded demo catalog (rows present but
 * no MusicBrainz ids), it replaces the dummy data with real Last.fm songs.
 * A short cooldown prevents hammering the Last.fm API when a seed fails.
 */
export async function ensureRealCatalog(): Promise<{ seeded: boolean; imported: number }> {
  try {
    const db = await adminDb();
    if (await isRealCatalog(db)) return { seeded: false, imported: 0 };
    if (Date.now() - lastSeedAttemptAt < SEED_COOLDOWN_MS) return { seeded: false, imported: 0 };
    lastSeedAttemptAt = Date.now();
    seedingPromise ??= reseedCatalog().finally(() => {
      seedingPromise = null;
    });
    const res = await seedingPromise;
    return { seeded: true, imported: res.imported };
  } catch (error) {
    seedingPromise = null;
    console.error("[ensureRealCatalog] seed failed:", error);
    return { seeded: false, imported: 0 };
  }
}

/**
 * Optional admin-only full reset: wipes all catalog/chart data and re-seeds
 * from Last.fm. Not required for normal use (auto-seed covers it).
 */
export const resetCatalogFromLastFm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    return reseedCatalog();
  });
