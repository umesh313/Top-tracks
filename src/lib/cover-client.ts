/**
 * Client-side album-art resolver (iTunes Search API — keyless, CORS-enabled).
 *
 * Live Last.fm chart rows carry no usable artwork (Last.fm serves placeholder
 * images), so <Cover resolve={{artist, track}} /> fills artwork in on the client
 * as rows scroll into view. Results are memoized in memory + sessionStorage.
 */

type CacheDoc = Record<string, string | null>;

const memory = new Map<string, string | null>();
const pending = new Map<string, Promise<string | null>>();
let sessionCache: CacheDoc | null = null;
const SS_KEY = "sb:cover-art:v1";
const SS_MAX = 400;

function loadSession(): CacheDoc {
  if (sessionCache) return sessionCache;
  sessionCache = {};
  try {
    if (typeof window !== "undefined") {
      const raw = window.sessionStorage.getItem(SS_KEY);
      if (raw) sessionCache = JSON.parse(raw) as CacheDoc;
    }
  } catch { /* ignore corrupt cache */ }
  return sessionCache;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function persist() {
  if (typeof window === "undefined" || saveTimer !== null) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      const doc = loadSession();
      const keys = Object.keys(doc);
      if (keys.length > SS_MAX) for (const k of keys.slice(0, keys.length - SS_MAX)) delete doc[k];
      window.sessionStorage.setItem(SS_KEY, JSON.stringify(doc));
    } catch { /* quota exceeded — ignore */ }
  }, 400);
}

const MAX_IN_FLIGHT = 4;
let inFlight = 0;
type Job = { key: string; url: string; resolve: (v: string | null) => void };
const jobs: Job[] = [];

function pump() {
  while (inFlight < MAX_IN_FLIGHT && jobs.length > 0) {
    const job = jobs.shift()!;
    inFlight += 1;
    fetch(job.url)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: unknown) => {
        const art =
          (j as { results?: { artworkUrl100?: string }[] } | null)?.results?.[0]?.artworkUrl100 ?? null;
        const url = art ? art.replace("100x100bb", "600x600bb") : null;
        memory.set(job.key, url); // null = known miss, don't retry
        loadSession()[job.key] = url;
        persist();
        pending.delete(job.key); // must happen before resolve: awaiting callers may re-request immediately
        job.resolve(url);
      })
      .catch(() => {
        pending.delete(job.key); // network error: don't cache — a later mount retries
        job.resolve(null);
      })
      .finally(() => {
        inFlight -= 1;
        pump();
      });
  }
}

/** Resolve album art for a track. Returns a URL, or null when nothing matched. */
export function requestCover(artist: string, track: string): Promise<string | null> {
  const key = `${artist.trim().toLowerCase()}::${track.trim().toLowerCase()}`;
  const mem = memory.has(key) ? memory.get(key) : loadSession()[key];
  if (mem !== undefined) return Promise.resolve(mem);
  const existing = pending.get(key);
  if (existing) return existing;
  const p = new Promise<string | null>((resolve) => {
    jobs.push({
      key,
      url: `https://itunes.apple.com/search?term=${encodeURIComponent(`${track} ${artist}`)}&entity=song&limit=1`,
      resolve,
    });
    pump();
  });
  pending.set(key, p); // cleared in pump() before the promise settles
  return p;
}
