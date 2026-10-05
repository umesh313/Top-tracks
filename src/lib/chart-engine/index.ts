/**
 * SONGBOARD chart engine — pure functions, no I/O.
 * Inputs: raw weekly metrics per song, previous week's entries, configurable weights.
 * Output: ranked chart entries with component scores (0–100).
 */
export type Weights = { streaming: number; radio: number; people: number; social: number; search: number };

export type RawMetrics = {
  songId: string;
  streaming: number;
  radio: number;
  social: number;
  search: number;
  peopleUp: number;
  peopleDown: number;
};

export type PrevEntry = { rank: number; songboardScore: number; peakRank: number; weeksOnChart: number };

export type ComputedEntry = {
  songId: string;
  rank: number;
  prevRank: number | null;
  peakRank: number;
  weeksOnChart: number;
  songboardScore: number;
  chartScore: number;
  peopleScore: number;
  momentumScore: number;
  streamingScore: number;
  radioScore: number;
  socialScore: number;
  searchScore: number;
};

export const DEFAULT_WEIGHTS: Weights = { streaming: 40, radio: 25, people: 20, social: 10, search: 5 };

const r2 = (n: number) => Math.round(n * 100) / 100;

/** People signal: upvotes minus half the downvotes, floored at zero. */
export const peopleRaw = (up: number, down: number) => Math.max(0, up - 0.5 * down);

/** Max-normalise a value to 0–100 against the week's leader. */
export const normalize = (v: number, max: number) => (max > 0 ? (100 * v) / max : 0);

export function computeChart(
  metrics: RawMetrics[],
  prev: Map<string, PrevEntry>,
  weights: Weights,
  size = 100,
): ComputedEntry[] {
  if (metrics.length === 0) return [];
  const max = (f: (m: RawMetrics) => number) => Math.max(...metrics.map(f));
  const ms = max((m) => m.streaming);
  const mr = max((m) => m.radio);
  const mso = max((m) => m.social);
  const mse = max((m) => m.search);
  const mp = max((m) => peopleRaw(m.peopleUp, m.peopleDown));
  const chartW = weights.streaming + weights.radio + weights.social + weights.search || 1;
  const totalW = chartW + weights.people || 1;

  const scored = metrics.map((m) => {
    const s = normalize(m.streaming, ms);
    const r = normalize(m.radio, mr);
    const so = normalize(m.social, mso);
    const se = normalize(m.search, mse);
    const p = normalize(peopleRaw(m.peopleUp, m.peopleDown), mp);
    const chart = (s * weights.streaming + r * weights.radio + so * weights.social + se * weights.search) / chartW;
    const total = (s * weights.streaming + r * weights.radio + p * weights.people + so * weights.social + se * weights.search) / totalW;
    return { m, s, r, so, se, p, chart, total };
  });

  scored.sort((a, b) => b.total - a.total);
  return scored.slice(0, size).map((x, i) => {
    const rank = i + 1;
    const pe = prev.get(x.m.songId);
    return {
      songId: x.m.songId,
      rank,
      prevRank: pe?.rank ?? null,
      peakRank: Math.min(pe?.peakRank ?? Infinity, rank),
      weeksOnChart: (pe?.weeksOnChart ?? 0) + 1,
      songboardScore: r2(x.total),
      chartScore: r2(x.chart),
      peopleScore: r2(x.p),
      momentumScore: r2(momentum(x.total, pe?.songboardScore)),
      streamingScore: r2(x.s),
      radioScore: r2(x.r),
      socialScore: r2(x.so),
      searchScore: r2(x.se),
    };
  });
}

/** 50 = flat; each point of SONGBOARD score gained/lost moves momentum by 4. New entries start at 60. */
export function momentum(current: number, previous: number | undefined) {
  if (previous === undefined) return 60;
  return Math.max(0, Math.min(100, 50 + (current - previous) * 4));
}

export type Movement = { kind: "new" | "up" | "down" | "same" | "re"; delta: number };
export function movement(rank: number, prevRank: number | null, weeksOnChart: number): Movement {
  if (prevRank == null) return { kind: weeksOnChart > 1 ? "re" : "new", delta: 0 };
  const d = prevRank - rank;
  return { kind: d > 0 ? "up" : d < 0 ? "down" : "same", delta: Math.abs(d) };
}
