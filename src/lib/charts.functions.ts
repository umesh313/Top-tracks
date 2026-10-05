import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { publicDb } from "./db.server";
import { fetchArtistImage, fetchLiveChartRows, fetchTrackCover, searchLiveCatalog } from "./lastfm.functions";

const SONG_SEL = "id,slug,title,hue,genre_id,country_code,release_date,duration_sec,artist:artists(id,slug,name,hue)";

export type Genre = { id: string; name: string; hue: number };
export type Country = { code: string; name: string; flag: string | null };

export type ChartRow = {
  rank: number; prev_rank: number | null; peak_rank: number; weeks_on_chart: number;
  songboard_score: number; chart_score: number; people_score: number; momentum_score: number;
  streaming_score: number; radio_score: number; social_score: number; search_score: number;
  song: { id: string; slug: string; title: string; hue: number; image: string | null; genre_id: string | null; country_code: string | null; release_date: string | null; duration_sec: number;
    artist: { id: string; slug: string; name: string; hue: number } };
};

export const getChart = createServerFn({ method: "GET" })
  .inputValidator((d: { weekId?: number } | undefined) => z.object({ weekId: z.number().int().optional() }).parse(d ?? {}))
  .handler(async () => {
    // LIVE-FIRST: real Last.fm data, computed in memory with a 10-min server
    // cache (see lastfm.functions). No DB seeding, no login, no fake rows.
    // Genres/countries are static lookups; the chart never waits on them.
    const liveRows = (await fetchLiveChartRows(100)) as unknown as ChartRow[];
    let genres: Genre[] = [];
    let countries: Country[] = [];
    try {
      const db = publicDb();
      const [{ data: g }, { data: c }] = await Promise.all([
        db.from("genres").select("*").order("name"),
        db.from("countries").select("*").order("name"),
      ]);
      genres = g ?? [];
      countries = c ?? [];
    } catch (e) {
      console.warn("[getChart] static lookup failed, continuing with live rows:", e instanceof Error ? e.message : e);
    }
    const week = { id: 0, week_start: new Date().toISOString().slice(0, 10) };
    return { week, weeks: [week], rows: liveRows, genres, countries, live: true };
  });

export const getSong = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const db = publicDb();
    const { data: song } = await db.from("songs").select(`${SONG_SEL},album:albums(title),genre:genres(name),country:countries(name,flag)`).eq("slug", data.slug).maybeSingle();
    if (song) {
      const [{ data: history }, { data: metrics }, { data: totals }, image] = await Promise.all([
        db.from("chart_entries").select("week_id,rank,songboard_score,chart_score,people_score,momentum_score,streaming_score,radio_score,social_score,search_score,prev_rank,peak_rank,weeks_on_chart,week:chart_weeks(week_start)").eq("song_id", song.id).order("week_id"),
        db.from("song_metrics").select("week_id,streaming,radio,social,search,people_up,people_down").eq("song_id", song.id).order("week_id"),
        db.rpc("vote_totals"),
        fetchTrackCover(String(song.artist?.name ?? ""), song.title).catch(() => null),
      ]);
      const live = (totals ?? []).find((t) => t.song_id === song.id);
      const { data: related } = await db.from("songs").select(SONG_SEL).eq("genre_id", song.genre_id ?? "").neq("id", song.id).limit(6);
      const relatedRows = (related ?? []).map((s) => ({ ...s, image: null as string | null }));
      for (let i = 0; i < relatedRows.length; i += 3) {
        await Promise.all(relatedRows.slice(i, i + 3).map(async (s) => {
          s.image = await fetchTrackCover(String(s.artist?.name ?? ""), s.title).catch(() => null);
        }));
      }
      return { song: { ...song, image }, history: history ?? [], metrics: metrics ?? [], live: { up: Number(live?.up ?? 0), down: Number(live?.down ?? 0) }, related: relatedRows };
    }
    // LIVE FALLBACK: resolve song detail from real Last.fm rows (no fake data).
    try {
      const liveRows = await fetchLiveChartRows(100);
      const match = liveRows.find((r) => r.song.slug === data.slug);
      if (!match) return null;
      const related = liveRows.filter((r) => r.song.slug !== data.slug).slice(0, 6).map((r) => r.song);
      return {
        song: { ...match.song, album: null, genre: null, country: null },
        history: [{ week_id: 0, rank: match.rank, songboard_score: match.songboard_score, chart_score: match.chart_score, people_score: match.people_score, momentum_score: match.momentum_score, streaming_score: match.streaming_score, radio_score: match.radio_score, social_score: match.social_score, search_score: match.search_score, prev_rank: null, peak_rank: match.rank, weeks_on_chart: 1, week: { week_start: new Date().toISOString().slice(0, 10) } }],
        metrics: [],
        live: { up: 0, down: 0 },
        related,
      };
    } catch {
      return null;
    }
  });

export const getArtist = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const db = publicDb();
    const { data: artist } = await db.from("artists").select("*,genre:genres(name),country:countries(name,flag)").eq("slug", data.slug).maybeSingle();
    if (artist) {
      const imageP = fetchArtistImage(artist.name).catch(() => null);
      const { data: songs } = await db.from("songs").select(`${SONG_SEL},album:albums(title)`).eq("artist_id", artist.id).order("release_date", { ascending: false });
      const ids = (songs ?? []).map((s) => s.id);
      const { data: entries } = ids.length
        ? await db.from("chart_entries").select("week_id,song_id,rank,songboard_score,peak_rank,weeks_on_chart").in("song_id", ids).order("week_id")
        : { data: [] };
      const rows = (songs ?? []).map((s) => ({ ...s, image: null as string | null }));
      for (let i = 0; i < Math.min(rows.length, 12); i += 4) {
        await Promise.all(rows.slice(i, i + 4).map(async (s) => {
          s.image = await fetchTrackCover(String(s.artist?.name ?? ""), s.title).catch(() => null);
        }));
      }
      return { artist: { ...artist, image: await imageP }, songs: rows, entries: entries ?? [] };
    }
    // LIVE FALLBACK: resolve artist detail from real Last.fm rows (no fake data).
    try {
      const liveRows = await fetchLiveChartRows(100);
      const mine = liveRows.filter((r) => r.song.artist.slug === data.slug);
      if (!mine.length) return null;
      const first = mine[0]!.song.artist;
      return {
        artist: { id: first.id, slug: first.slug, name: first.name, hue: first.hue, image: await fetchArtistImage(first.name).catch(() => null), genre: null, country: null, bio: null, monthly_listeners: 0 },
        songs: mine.map((r) => ({ ...r.song, album: null })),
        entries: mine.map((r) => ({ week_id: 0, song_id: r.song.id, rank: r.rank, songboard_score: r.songboard_score, peak_rank: r.rank, weeks_on_chart: 1 })),
      };
    } catch {
      return { artist: null, songs: [], entries: [] };
    }
  });

export const searchCatalog = createServerFn({ method: "GET" })
  .inputValidator((d: { q: string }) => z.object({ q: z.string().max(80) }).parse(d))
  .handler(async ({ data }) => {
    // LIVE-ONLY: real Last.fm track/artist search. No fake DB rows.
    return searchLiveCatalog(data.q);
  });

export const getBattles = createServerFn({ method: "GET" }).handler(async () => {
  const db = publicDb();
  const [{ data: battles }, { data: totals }] = await Promise.all([
    db.from("battles").select(`id,a:songs!battles_song_a_fkey(${SONG_SEL}),b:songs!battles_song_b_fkey(${SONG_SEL})`).order("created_at", { ascending: false }).limit(12),
    db.rpc("battle_totals"),
  ]);
  return (battles ?? []).map((b) => {
    const t = (totals ?? []).filter((x) => x.battle_id === b.id);
    const n = (id: string) => Number(t.find((x) => x.choice === id)?.n ?? 0);
    return { ...b, votesA: n(b.a.id), votesB: n(b.b.id) };
  });
});

export const getWeights = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await publicDb().from("scoring_config").select("*").eq("id", 1).single();
  return data!;
});
