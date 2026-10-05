import type { DataProvider, SongSnapshot } from "./index";

type MetricKey = "streaming" | "radio" | "social" | "search";

type TrackInfo = { playcount: number; listeners: number } | null;

const DERIVATIONS: Record<MetricKey, (t: TrackInfo) => number> = {
  streaming: (t) => t?.playcount ?? 0,
  radio: (t) => t?.listeners ?? 0,
  social: (t) => (t ? Math.round((t.playcount / Math.max(1, t.listeners)) * 100) : 0),
  search: (t) => (t ? Math.round(Math.sqrt(t.playcount * t.listeners) / 100) : 0),
};

function lastFmKey(): string {
  const key = process.env["LASTFM_API_KEY"];
  if (!key) throw new Error("Last.fm is not configured (set LASTFM_API_KEY)");
  return key;
}

async function fetchTrackInfo(s: SongSnapshot): Promise<TrackInfo> {
  try {
    const params = new URLSearchParams({
      method: "track.getInfo",
      api_key: lastFmKey(),
      format: "json",
      autocorrect: "1",
    });
    if (s.mbid) params.set("mbid", s.mbid);
    else {
      if (!s.artist || !s.title) return null;
      params.set("artist", s.artist);
      params.set("track", s.title);
    }

    const res = await fetch(`https://ws.audioscrobbler.com/2.0/?${params.toString()}`);
    if (!res.ok) return null;
    const json = (await res.json()) as { track?: { playcount?: string | number; listeners?: string | number } };
    const t = json?.track;
    if (!t) return null;
    return {
      playcount: Number(t.playcount ?? 0),
      listeners: Number(t.listeners ?? 0),
    };
  } catch {
    return null;
  }
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const worker = async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      const item = items[idx]!;
      results[idx] = await fn(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const infoCache = new Map<number, Map<string, TrackInfo>>();
const infoInFlight = new Map<number, Promise<Map<string, TrackInfo>>>();

function getTrackInfo(songs: SongSnapshot[], seed: number): Promise<Map<string, TrackInfo>> {
  const hit = infoCache.get(seed);
  if (hit) return Promise.resolve(hit);
  const inFlight = infoInFlight.get(seed);
  if (inFlight) return inFlight;

  const request = (async () => {
    const pairs = await mapWithConcurrency(songs, 4, async (s) => {
      const info = await fetchTrackInfo(s);
      return [s.songId, info] as const;
    });
    const map = new Map(pairs);
    infoCache.set(seed, map);
    infoInFlight.delete(seed);
    return map;
  })();
  infoInFlight.set(seed, request);
  return request;
}

export class LastFmProvider implements DataProvider {
  constructor(
    readonly name: string,
    private readonly metric: MetricKey,
  ) {}

  async fetchWeek(songs: SongSnapshot[], seed: number): Promise<Map<string, number>> {
    const info = await getTrackInfo(songs, seed);
    const derive = DERIVATIONS[this.metric];
    const out = new Map<string, number>();
    for (const s of songs) out.set(s.songId, derive(info.get(s.songId) ?? null));
    return out;
  }
}

export const LastFmStreaming = new LastFmProvider("lastfm-streaming", "streaming");
export const LastFmRadio = new LastFmProvider("lastfm-radio", "radio");
export const LastFmSocial = new LastFmProvider("lastfm-social", "social");
export const LastFmSearch = new LastFmProvider("lastfm-search", "search");

