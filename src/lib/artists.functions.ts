import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { deezerArtistImage, fetchLiveChartRows } from "./lastfm.functions";

function lastFmKey(): string {
  const key = process.env["LASTFM_API_KEY"] ?? (import.meta.env as Record<string, string | undefined>)?.["VITE_LASTFM_API_KEY"];
  if (!key) throw new Error("Last.fm is not configured (set LASTFM_API_KEY in .env / .env.local)");
  return key;
}
async function fetchWithTimeout(url: string, ms = 12_000): Promise<Response> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { signal: c.signal }); } finally { clearTimeout(t); }
}
export function slugify(v: string) {
  return v.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "artist";
}
function hueFromId(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}
export function fmtDuration(sec: number | null): string {
  if (!sec || sec <= 0) return "—";
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
}
export function fmtPlays(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
}
type Img = { "#text"?: string; size?: string };
const PLACEHOLDER_FP = "2a96cbd8b46e442fc41c2b86b821562";
function isPlaceholderImage(url: string | undefined | null): boolean {
  return !!url && url.includes(PLACEHOLDER_FP);
}
function pickImage(images: Img[] | undefined): string | null {
  if (!images?.length) return null;
  for (const s of ["extralarge", "large", "medium", "small"]) {
    const f = images.find((i) => i.size === s && i["#text"] && !isPlaceholderImage(i["#text"]));
    if (f?.["#text"]) return f["#text"]!;
  }
  return images.find((i) => i["#text"] && !isPlaceholderImage(i["#text"]))?.["#text"] ?? null;
}
export type ArtistHit = { name: string; slug: string; listeners: number; image: string | null; hue: number };
export type TopSong = { title: string; album: string | null; year: string | null; durationSec: number | null; durationLabel: string; cover: string | null; playcount: number; listeners: number; chartRank: number | null; chartScore: number | null };
export type BrowseArtist = ArtistHit & { playcount: number };
export type GenreTrack = { rank: number; title: string; artist: string; playcount: number; listeners: number; cover: string | null; durationLabel: string };

type LfmArtist = { name?: string; playcount?: string; listeners?: string; image?: Img[] };
type LfmTrack = { name?: string; artist?: { name?: string }; playcount?: string; listeners?: string; image?: Img[] };

const browseCache = new Map<string, { at: number; data: unknown }>();
const BROWSE_TTL = 15 * 60 * 1000;
function browseGet<T>(key: string): T | null {
  const c = browseCache.get(key);
  if (c && Date.now() - c.at < BROWSE_TTL) return c.data as T;
  return null;
}
function browseSet(key: string, data: unknown) {
  browseCache.set(key, { at: Date.now(), data });
  if (browseCache.size > 60) browseCache.delete(browseCache.keys().next().value!);
}
function toArtistHit(a: LfmArtist): ArtistHit {
  const nm = String(a.name ?? "").trim();
  return { name: nm, slug: slugify(nm), listeners: Number(a.listeners ?? 0) || 0, image: pickImage(a.image), hue: hueFromId(nm) };
}
function toGenreTrack(t: LfmTrack, i: number): GenreTrack {
  return { rank: i + 1, title: String(t.name ?? "—"), artist: String(t.artist?.name ?? "Unknown"), playcount: Number(t.playcount ?? 0) || 0, listeners: Number(t.listeners ?? 0) || 0, cover: pickImage(t.image), durationLabel: "—" };
}

/** Paginated global artist database: chart.gettopartists (1000 artists, 20 pages). */
export const browseArtists = createServerFn({ method: "GET" })
  .inputValidator((d: { page?: number }) => z.object({ page: z.number().int().min(1).max(500).optional() }).parse(d ?? {}))
  .handler(async ({ data }): Promise<{ artists: BrowseArtist[]; page: number; totalPages: number; total: number }> => {
    const page = data.page ?? 1;
    const ck = `chart-artists::${page}`;
    const hit = browseGet<{ artists: BrowseArtist[]; page: number; totalPages: number; total: number }>(ck);
    if (hit) return hit;
    const params = new URLSearchParams({ method: "chart.gettopartists", api_key: lastFmKey(), format: "json", limit: "24", page: String(page) });
    const res = await fetchWithTimeout(`https://ws.audioscrobbler.com/2.0/?${params}`);
    if (!res.ok) throw new Error(`Last.fm artists failed (${res.status})`);
    const json = (await res.json()) as { artists?: { artist?: LfmArtist[]; "@attr"?: { page?: string; totalPages?: string; total?: string } } };
    const artists: BrowseArtist[] = (json.artists?.artist ?? []).filter((a) => a.name?.trim()).map((a) => ({ ...toArtistHit(a), playcount: Number(a.playcount ?? 0) || 0 }));
    // Real artist photos from Deezer (Last.fm/iTunes artist art is placeholder-only).
    // Fill the whole page, chunked to stay under Deezer's burst limits.
    const missing = artists.filter((a) => !a.image);
    for (let i = 0; i < missing.length; i += 6) {
      await Promise.allSettled(missing.slice(i, i + 6).map(async (a) => {
        a.image = await deezerArtistImage(a.name);
      }));
    }
    const out = { artists, page: Number(json.artists?.["@attr"]?.page ?? page) || page, totalPages: Math.min(500, Number(json.artists?.["@attr"]?.totalPages ?? 500) || 500), total: Number(json.artists?.["@attr"]?.total ?? 1000) || 1000 };
    browseSet(ck, out);
    return out;
  });

export const GENRE_TAGS = [
  { id: "pop", name: "Pop", hue: 35 }, { id: "hip-hop", name: "Hip-Hop", hue: 260 },
  { id: "rock", name: "Rock", hue: 0 }, { id: "latin", name: "Latin", hue: 150 },
  { id: "electronic", name: "Electronic", hue: 200 }, { id: "indie", name: "Indie", hue: 120 },
  { id: "r-n-b", name: "R&B", hue: 320 }, { id: "country", name: "Country", hue: 60 },
  { id: "metal", name: "Metal", hue: 10 }, { id: "jazz", name: "Jazz", hue: 45 },
  { id: "k-pop", name: "K-Pop", hue: 290 }, { id: "classical", name: "Classical", hue: 180 },
];

/** Paginated genre tracks: tag.gettoptracks (real songs for the tag). */
export const browseGenreTracks = createServerFn({ method: "GET" })
  .inputValidator((d: { tag: string; page?: number }) => z.object({ tag: z.string().min(1).max(40), page: z.number().int().min(1).max(20).optional() }).parse(d))
  .handler(async ({ data }): Promise<{ tag: string; tracks: GenreTrack[]; page: number; totalPages: number }> => {
    const tag = data.tag.trim().toLowerCase().slice(0, 40);
    if (!GENRE_TAGS.some((g) => g.id === tag)) throw new Error(`Unknown genre: ${tag}`);
    const page = data.page ?? 1;
    const ck = `tag-tracks::${tag}::${page}`;
    const hit = browseGet<{ tag: string; tracks: GenreTrack[]; page: number; totalPages: number }>(ck);
    if (hit) return hit;
    const params = new URLSearchParams({ method: "tag.gettoptracks", tag, api_key: lastFmKey(), format: "json", limit: "24", page: String(page) });
    const res = await fetchWithTimeout(`https://ws.audioscrobbler.com/2.0/?${params}`);
    if (!res.ok) throw new Error(`Last.fm genre tracks failed (${res.status})`);
    const json = (await res.json()) as { tracks?: { track?: LfmTrack[]; "@attr"?: { page?: string; totalPages?: string } } };
    const tracks = (json.tracks?.track ?? []).filter((t) => t.name?.trim()).map(toGenreTrack);
    const out = { tag, tracks, page: Number(json.tracks?.["@attr"]?.page ?? page) || page, totalPages: Math.min(20, Number(json.tracks?.["@attr"]?.totalPages ?? 10) || 10) };
    browseSet(ck, out);
    return out;
  });

/**
 * Countries supported by Last.fm's geo.* methods.
 * Every `lfm` value was verified against geo.gettoptracks (error 6 = invalid).
 */
export const COUNTRY_LIST = [
  { code: "DZ", name: "Algeria", lfm: "algeria", flag: "🇩🇿" },
  { code: "AR", name: "Argentina", lfm: "argentina", flag: "🇦🇷" },
  { code: "AU", name: "Australia", lfm: "australia", flag: "🇦🇺" },
  { code: "AT", name: "Austria", lfm: "austria", flag: "🇦🇹" },
  { code: "AZ", name: "Azerbaijan", lfm: "azerbaijan", flag: "🇦🇿" },
  { code: "BH", name: "Bahrain", lfm: "bahrain", flag: "🇧🇭" },
  { code: "BD", name: "Bangladesh", lfm: "bangladesh", flag: "🇧🇩" },
  { code: "BE", name: "Belgium", lfm: "belgium", flag: "🇧🇪" },
  { code: "BG", name: "Bulgaria", lfm: "bulgaria", flag: "🇧🇬" },
  { code: "BR", name: "Brazil", lfm: "brazil", flag: "🇧🇷" },
  { code: "CA", name: "Canada", lfm: "canada", flag: "🇨🇦" },
  { code: "CL", name: "Chile", lfm: "chile", flag: "🇨🇱" },
  { code: "CO", name: "Colombia", lfm: "colombia", flag: "🇨🇴" },
  { code: "CR", name: "Costa Rica", lfm: "costa rica", flag: "🇨🇷" },
  { code: "HR", name: "Croatia", lfm: "croatia", flag: "🇭🇷" },
  { code: "CZ", name: "Czech Republic", lfm: "czech republic", flag: "🇨🇿" },
  { code: "DK", name: "Denmark", lfm: "denmark", flag: "🇩🇰" },
  { code: "DO", name: "Dominican Republic", lfm: "dominican republic", flag: "🇩🇴" },
  { code: "EC", name: "Ecuador", lfm: "ecuador", flag: "🇪🇨" },
  { code: "EG", name: "Egypt", lfm: "egypt", flag: "🇪🇬" },
  { code: "EE", name: "Estonia", lfm: "estonia", flag: "🇪🇪" },
  { code: "FI", name: "Finland", lfm: "finland", flag: "🇫🇮" },
  { code: "FR", name: "France", lfm: "france", flag: "🇫🇷" },
  { code: "GE", name: "Georgia", lfm: "georgia", flag: "🇬🇪" },
  { code: "DE", name: "Germany", lfm: "germany", flag: "🇩🇪" },
  { code: "GH", name: "Ghana", lfm: "ghana", flag: "🇬🇭" },
  { code: "GR", name: "Greece", lfm: "greece", flag: "🇬🇷" },
  { code: "GT", name: "Guatemala", lfm: "guatemala", flag: "🇬🇹" },
  { code: "HU", name: "Hungary", lfm: "hungary", flag: "🇭🇺" },
  { code: "IS", name: "Iceland", lfm: "iceland", flag: "🇮🇸" },
  { code: "IN", name: "India", lfm: "india", flag: "🇮🇳" },
  { code: "ID", name: "Indonesia", lfm: "indonesia", flag: "🇮🇩" },
  { code: "IE", name: "Ireland", lfm: "ireland", flag: "🇮🇪" },
  { code: "IL", name: "Israel", lfm: "israel", flag: "🇮🇱" },
  { code: "IT", name: "Italy", lfm: "italy", flag: "🇮🇹" },
  { code: "JP", name: "Japan", lfm: "japan", flag: "🇯🇵" },
  { code: "JO", name: "Jordan", lfm: "jordan", flag: "🇯🇴" },
  { code: "KZ", name: "Kazakhstan", lfm: "kazakhstan", flag: "🇰🇿" },
  { code: "KE", name: "Kenya", lfm: "kenya", flag: "🇰🇪" },
  { code: "KR", name: "South Korea", lfm: "korea, republic of", flag: "🇰🇷" },
  { code: "KW", name: "Kuwait", lfm: "kuwait", flag: "🇰🇼" },
  { code: "LV", name: "Latvia", lfm: "latvia", flag: "🇱🇻" },
  { code: "LB", name: "Lebanon", lfm: "lebanon", flag: "🇱🇧" },
  { code: "LT", name: "Lithuania", lfm: "lithuania", flag: "🇱🇹" },
  { code: "MY", name: "Malaysia", lfm: "malaysia", flag: "🇲🇾" },
  { code: "MX", name: "Mexico", lfm: "mexico", flag: "🇲🇽" },
  { code: "MA", name: "Morocco", lfm: "morocco", flag: "🇲🇦" },
  { code: "NL", name: "Netherlands", lfm: "netherlands", flag: "🇳🇱" },
  { code: "NZ", name: "New Zealand", lfm: "new zealand", flag: "🇳🇿" },
  { code: "NG", name: "Nigeria", lfm: "nigeria", flag: "🇳🇬" },
  { code: "MK", name: "North Macedonia", lfm: "macedonia", flag: "🇲🇰" },
  { code: "NO", name: "Norway", lfm: "norway", flag: "🇳🇴" },
  { code: "OM", name: "Oman", lfm: "oman", flag: "🇴🇲" },
  { code: "PK", name: "Pakistan", lfm: "pakistan", flag: "🇵🇰" },
  { code: "PA", name: "Panama", lfm: "panama", flag: "🇵🇦" },
  { code: "PE", name: "Peru", lfm: "peru", flag: "🇵🇪" },
  { code: "PH", name: "Philippines", lfm: "philippines", flag: "🇵🇭" },
  { code: "PL", name: "Poland", lfm: "poland", flag: "🇵🇱" },
  { code: "PT", name: "Portugal", lfm: "portugal", flag: "🇵🇹" },
  { code: "PR", name: "Puerto Rico", lfm: "puerto rico", flag: "🇵🇷" },
  { code: "QA", name: "Qatar", lfm: "qatar", flag: "🇶🇦" },
  { code: "RO", name: "Romania", lfm: "romania", flag: "🇷🇴" },
  { code: "RU", name: "Russia", lfm: "russian federation", flag: "🇷🇺" },
  { code: "SA", name: "Saudi Arabia", lfm: "saudi arabia", flag: "🇸🇦" },
  { code: "SN", name: "Senegal", lfm: "senegal", flag: "🇸🇳" },
  { code: "RS", name: "Serbia", lfm: "serbia", flag: "🇷🇸" },
  { code: "SG", name: "Singapore", lfm: "singapore", flag: "🇸🇬" },
  { code: "SK", name: "Slovakia", lfm: "slovakia", flag: "🇸🇰" },
  { code: "SI", name: "Slovenia", lfm: "slovenia", flag: "🇸🇮" },
  { code: "ZA", name: "South Africa", lfm: "south africa", flag: "🇿🇦" },
  { code: "ES", name: "Spain", lfm: "spain", flag: "🇪🇸" },
  { code: "LK", name: "Sri Lanka", lfm: "sri lanka", flag: "🇱🇰" },
  { code: "SE", name: "Sweden", lfm: "sweden", flag: "🇸🇪" },
  { code: "CH", name: "Switzerland", lfm: "switzerland", flag: "🇨🇭" },
  { code: "TH", name: "Thailand", lfm: "thailand", flag: "🇹🇭" },
  { code: "TN", name: "Tunisia", lfm: "tunisia", flag: "🇹🇳" },
  { code: "TR", name: "Turkey", lfm: "turkey", flag: "🇹🇷" },
  { code: "UA", name: "Ukraine", lfm: "ukraine", flag: "🇺🇦" },
  { code: "AE", name: "United Arab Emirates", lfm: "united arab emirates", flag: "🇦🇪" },
  { code: "GB", name: "United Kingdom", lfm: "united kingdom", flag: "🇬🇧" },
  { code: "US", name: "United States", lfm: "united states", flag: "🇺🇸" },
  { code: "VE", name: "Venezuela", lfm: "venezuela", flag: "🇻🇪" },
];

/** Paginated country trending tracks + top artists: geo.gettoptracks / geo.gettopartists. */
export const browseCountryTracks = createServerFn({ method: "GET" })
  .inputValidator((d: { code: string; page?: number }) => z.object({ code: z.string().min(2).max(4), page: z.number().int().min(1).max(20).optional() }).parse(d))
  .handler(async ({ data }): Promise<{ code: string; name: string; flag: string; tracks: GenreTrack[]; topArtists: string[]; page: number; totalPages: number }> => {
    const code = data.code.trim().toUpperCase();
    const entry = COUNTRY_LIST.find((c) => c.code === code);
    if (!entry) throw new Error(`Unknown country: ${code}`);
    const page = data.page ?? 1;
    const ck = `geo-tracks::${code}::${page}`;
    const hit = browseGet<{ code: string; name: string; flag: string; tracks: GenreTrack[]; topArtists: string[]; page: number; totalPages: number }>(ck);
    if (hit) return hit;
    const tp = new URLSearchParams({ method: "geo.gettoptracks", country: entry.lfm, api_key: lastFmKey(), format: "json", limit: "24", page: String(page) });
    const ap = new URLSearchParams({ method: "geo.gettopartists", country: entry.lfm, api_key: lastFmKey(), format: "json", limit: "10", page: "1" });
    const [tr, ar] = await Promise.all([
      fetchWithTimeout(`https://ws.audioscrobbler.com/2.0/?${tp}`),
      page === 1 ? fetchWithTimeout(`https://ws.audioscrobbler.com/2.0/?${ap}`) : Promise.resolve(null),
    ]);
    if (!tr.ok) throw new Error(`Last.fm country tracks failed (${tr.status})`);
    const tj = (await tr.json()) as { tracks?: { track?: LfmTrack[]; "@attr"?: { page?: string; totalPages?: string } } };
    const tracks = (tj.tracks?.track ?? []).filter((t) => t.name?.trim()).map(toGenreTrack);
    let topArtists: string[] = [];
    if (ar && ar.ok) {
      const aj = (await ar.json()) as { topartists?: { artist?: { name?: string }[] } };
      topArtists = (aj.topartists?.artist ?? []).map((a) => String(a.name ?? "")).filter(Boolean).slice(0, 10);
    }
    const out = { code, name: entry.name, flag: entry.flag, tracks, topArtists, page: Number(tj.tracks?.["@attr"]?.page ?? page) || page, totalPages: Math.min(20, Number(tj.tracks?.["@attr"]?.totalPages ?? 10) || 10) };
    browseSet(ck, out);
    return out;
  });

export const searchArtists = createServerFn({ method: "GET" })
  .inputValidator((d: { q: string }) => z.object({ q: z.string().max(80) }).parse(d))
  .handler(async ({ data }): Promise<{ artists: ArtistHit[] }> => {
    const q = data.q.trim().slice(0, 80);
    if (q.length < 2) return { artists: [] };
    const params = new URLSearchParams({ method: "artist.search", artist: q, api_key: lastFmKey(), format: "json", limit: "10" });
    const res = await fetchWithTimeout(`https://ws.audioscrobbler.com/2.0/?${params}`);
    if (!res.ok) throw new Error(`Last.fm search failed (${res.status})`);
    const json = (await res.json()) as { results?: { artistmatches?: { artist?: { name?: string; listeners?: string; image?: Img[] }[] } } };
    const artists: ArtistHit[] = [];
    for (const a of json.results?.artistmatches?.artist ?? []) {
      const nm = String(a.name ?? "").trim();
      if (!nm) continue;
      artists.push({ name: nm, slug: slugify(nm), listeners: Number(a.listeners ?? 0) || 0, image: pickImage(a.image), hue: hueFromId(nm) });
    }
    // Real photos for the first few results (Last.fm artist art is placeholder-only).
    const fill = artists.slice(0, 3).filter((a) => !a.image);
    if (fill.length) await Promise.allSettled(fill.map(async (a) => { a.image = await deezerArtistImage(a.name); }));
    return { artists };
  });

/** All artists from the live chart — deduped from cached rows, zero extra Last.fm calls. */
export const getTrendingArtists = createServerFn({ method: "GET" }).handler(async (): Promise<{ artists: ArtistHit[] }> => {
  const rows = await fetchLiveChartRows(100);
  const byName = new Map<string, { listeners: number; image: string | null }>();
  for (const r of rows) {
    const nm = r.song.artist.name;
    const cur = byName.get(nm.toLowerCase());
    if (!cur) byName.set(nm.toLowerCase(), { listeners: 0, image: null });
  }
  // Names in display form
  const names = [...new Map(rows.map((r) => [r.song.artist.name.toLowerCase(), r.song.artist.name])).entries()];
  const out: ArtistHit[] = names.map(([_, real]) => ({ name: real, slug: slugify(real), listeners: 0, image: null, hue: hueFromId(real) }));
  // Fill listeners + images from trending info in one batched pass (best-effort)
  const key = lastFmKey();
  for (let i = 0; i < out.length; i += 8) {
    const settled = await Promise.allSettled(out.slice(i, i + 8).map(async (a) => {
      try {
        const p = new URLSearchParams({ method: "artist.getinfo", artist: a.name, api_key: key, format: "json", autocorrect: "1" });
        const res = await fetchWithTimeout(`https://ws.audioscrobbler.com/2.0/?${p}`, 7000);
        if (!res.ok) return;
        const j = (await res.json()) as { artist?: { name?: string; stats?: { listeners?: string }; image?: Img[] } };
        a.listeners = Number(j.artist?.stats?.listeners ?? 0) || 0;
        a.image = pickImage(j.artist?.image);
        if (j.artist?.name) a.name = String(j.artist.name);
      } catch { /* ignore */ }
    }));
    void settled;
  }
  void byName;
  out.sort((a, b) => a.name.localeCompare(b.name));
  // Real photo fill for artists Last.fm has no (usable) image for.
  const missing = out.filter((a) => !a.image).slice(0, 12);
  if (missing.length) {
    const settled = await Promise.allSettled(missing.map(async (a) => {
      a.image = await deezerArtistImage(a.name);
    }));
    void settled;
  }
  return { artists: out };
});

const topSongsCache = new Map<string, { at: number; data: { artist: ArtistHit & { playcount: number; bio: string | null }; songs: TopSong[] } }>();
const TOP_TTL = 10 * 60 * 1000;

async function musicBrainzEnrich(artist: string, title: string): Promise<{ durationSec: number | null; year: string | null; album: string | null; cover: string | null }> {
  const empty = { durationSec: null, year: null, album: null, cover: null };
  try {
    const q = `recording:"${title.replace(/"/g, "")}" AND artist:"${artist.replace(/"/g, "")}"`;
    const res = await fetchWithTimeout(`https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(q)}&fmt=json&limit=1`, 8000);
    if (!res.ok) return empty;
    const json = (await res.json()) as { recordings?: { length?: number; releases?: { date?: string; title?: string; "release-group"?: { id?: string; title?: string; "first-release-date"?: string } }[] }[] };
    const rec = json.recordings?.[0];
    if (!rec) return empty;
    const rel = rec.releases?.[0];
    const rg = rel?.["release-group"];
    const date = rg?.["first-release-date"] ?? rel?.date ?? null;
    let cover: string | null = null;
    if (rg?.id) {
      try {
        const c = await fetchWithTimeout(`https://coverartarchive.org/release-group/${rg.id}/front-250`, 8000);
        if (c.ok && (c.headers.get("content-type") ?? "").startsWith("image")) cover = c.url;
      } catch { /* ignore */ }
    }
    return { durationSec: rec.length ? Math.round(rec.length / 1000) : null, year: date ? date.slice(0, 4) : null, album: rg?.title ?? rel?.title ?? null, cover };
  } catch { return empty; }
}

export const getArtistTopSongs = createServerFn({ method: "GET" })
  .inputValidator((d: { name: string; limit?: number }) => z.object({ name: z.string().min(1).max(120), limit: z.number().int().min(5).max(20).optional() }).parse(d))
  .handler(async ({ data }) => {
    const name = data.name.trim().slice(0, 120);
    const limit = data.limit ?? 10;
    const ck2 = `${name.toLowerCase()}::${limit}`;
    const cached = topSongsCache.get(ck2);
    if (cached && Date.now() - cached.at < TOP_TTL) return cached.data;
    const key = lastFmKey();
    const infoP = new URLSearchParams({ method: "artist.getinfo", artist: name, api_key: key, format: "json", autocorrect: "1" });
    const topP = new URLSearchParams({ method: "artist.gettoptracks", artist: name, api_key: key, format: "json", autocorrect: "1", limit: String(limit) });
    const [infoRes, topRes] = await Promise.all([
      fetchWithTimeout(`https://ws.audioscrobbler.com/2.0/?${infoP}`),
      fetchWithTimeout(`https://ws.audioscrobbler.com/2.0/?${topP}`),
    ]);
    if (!topRes.ok) throw new Error(`Last.fm top tracks failed (${topRes.status})`);
    const topJson = (await topRes.json()) as { toptracks?: { "@attr"?: { artist?: string }; track?: { name?: string; playcount?: string; listeners?: string; image?: Img[] }[] } };
    const canon = String(topJson.toptracks?.["@attr"]?.artist ?? name);
    let bio: string | null = null;
    let aImg: string | null = null;
    let aListeners = 0;
    let aPlays = 0;
    const tracks = (topJson.toptracks?.track ?? []).filter((t) => t.name?.trim()).slice(0, limit);
    if (infoRes.ok) {
      const ij = (await infoRes.json()) as { artist?: { stats?: { listeners?: string; playcount?: string }; bio?: { summary?: string }; image?: Img[] } };
      aImg = pickImage(ij.artist?.image);
      aListeners = Number(ij.artist?.stats?.listeners ?? 0) || 0;
      aPlays = Number(ij.artist?.stats?.playcount ?? 0) || 0;
      bio = (ij.artist?.bio?.summary ?? "").replace(/<[^>]*>/g, "").split("Read more")[0]?.trim() || null;
    }
    // Photo chain: Last.fm artist image -> first real track art -> Deezer -> iTunes
    let trackFallbackImg: string | null = null;
    for (const t of tracks) { const im = pickImage(t.image); if (im) { trackFallbackImg = im; break; } }
    if (!aImg && !trackFallbackImg) aImg = await deezerArtistImage(canon);
    if (!aImg && !trackFallbackImg) {
      try {
        const r = await fetchWithTimeout(`https://itunes.apple.com/search?term=${encodeURIComponent(canon)}&entity=musicArtist&limit=1`, 8000);
        if (r.ok) {
          const j = (await r.json()) as { results?: { artworkUrl100?: string }[] };
          const art = j.results?.[0]?.artworkUrl100?.replace("100x100bb", "600x600bb");
          if (art) aImg = art;
        }
      } catch { /* ignore */ }
    }
    let chartByKey = new Map<string, { rank: number; score: number }>();
    try {
      const rows = await fetchLiveChartRows(100);
      chartByKey = new Map(rows.map((r) => [`${r.song.artist.name.toLowerCase()}::${r.song.title.toLowerCase()}`, { rank: r.rank, score: r.songboard_score }]));
    } catch { /* best-effort */ }
    const songs: TopSong[] = [];
    for (let i = 0; i < tracks.length; i += 3) {
      const settled = await Promise.allSettled(tracks.slice(i, i + 3).map(async (t) => {
        const title = String(t.name ?? "").trim();
        const playcount = Number(t.playcount ?? 0) || 0;
        const listeners = Number(t.listeners ?? 0) || 0;
        let durationSec: number | null = null;
        let album: string | null = null;
        let year: string | null = null;
        let cover: string | null = pickImage(t.image);
        try {
          const p = new URLSearchParams({ method: "track.getInfo", artist: canon, track: title, api_key: key, format: "json", autocorrect: "1" });
          const r = await fetchWithTimeout(`https://ws.audioscrobbler.com/2.0/?${p}`, 8000);
          if (r.ok) {
            const j = (await r.json()) as { track?: { duration?: string; album?: { title?: string; image?: Img[] }; wiki?: { published?: string } } };
            const d = Number(j.track?.duration ?? 0);
            if (d > 0) durationSec = Math.round(d / 1000);
            if (j.track?.album?.title) album = j.track.album.title;
            const ai = pickImage(j.track?.album?.image);
            if (ai) cover = ai;
            const m = (j.track?.wiki?.published ?? "").match(/(\d{4})/);
            if (m) year = m[1]!;
          }
        } catch { /* ignore */ }
        if (!durationSec || !year || !album || !cover) {
          const mb = await musicBrainzEnrich(canon, title);
          durationSec ??= mb.durationSec;
          year ??= mb.year;
          album ??= mb.album;
          cover ??= mb.cover;
        }
        const c = chartByKey.get(`${canon.toLowerCase()}::${title.toLowerCase()}`);
        return { title, album, year, durationSec, durationLabel: fmtDuration(durationSec), cover, playcount, listeners, chartRank: c?.rank ?? null, chartScore: c?.score ?? null } as TopSong;
      }));
      for (const r of settled) if (r.status === "fulfilled") songs.push(r.value);
    }
    const out = { artist: { name: canon, slug: slugify(canon), listeners: aListeners, playcount: aPlays, image: aImg ?? trackFallbackImg, hue: hueFromId(canon), bio }, songs };
    topSongsCache.set(ck2, { at: Date.now(), data: out });
    return out;
  });

