import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { publicDb } from "./db.server";
import {
  fetchArtistImage,
  fetchLiveChartRows,
  fetchTrackCover,
  searchLiveCatalog,
} from "./lastfm.functions";
import { ArtistNotFoundError, resolveArtistByName } from "./artists.functions";

const SONG_SEL =
  "id,slug,title,hue,genre_id,country_code,release_date,duration_sec,artist:artists(id,slug,name,hue)";

export type Genre = { id: string; name: string; hue: number };
export type Country = { code: string; name: string; flag: string | null };

export type ChartRow = {
  rank: number;
  prev_rank: number | null;
  peak_rank: number;
  weeks_on_chart: number;
  songboard_score: number;
  chart_score: number;
  people_score: number;
  momentum_score: number;
  streaming_score: number;
  radio_score: number;
  social_score: number;
  search_score: number;
  song: {
    id: string;
    slug: string;
    title: string;
    hue: number;
    image: string | null;
    genre_id: string | null;
    country_code: string | null;
    release_date: string | null;
    duration_sec: number;
    artist: { id: string; slug: string; name: string; hue: number };
  };
};

export const getChart = createServerFn({ method: "GET" })
  .inputValidator((d: { weekId?: number } | undefined) =>
    z.object({ weekId: z.number().int().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    let genres: Genre[] = [];
    let countries: Country[] = [];
    try {
      const db = publicDb();
      const [
        { data: g, error: genreError },
        { data: c, error: countryError },
        { data: publishedWeeks, error: weeksError },
      ] = await Promise.all([
        db.from("genres").select("*").order("name"),
        db.from("countries").select("*").order("name"),
        db
          .from("chart_weeks")
          .select("id,week_start")
          .eq("status", "published")
          .eq("source", "lastfm")
          .order("week_start", { ascending: false })
          .limit(52),
      ]);
      if (genreError) throw genreError;
      if (countryError) throw countryError;
      if (weeksError) throw weeksError;
      genres = g ?? [];
      countries = c ?? [];
      const weeks = publishedWeeks ?? [];
      let week =
        data.weekId === undefined
          ? (weeks[0] ?? null)
          : (weeks.find((candidate) => candidate.id === data.weekId) ?? null);

      if (data.weekId !== undefined && !week) {
        const { data: requestedWeek, error: requestedWeekError } = await db
          .from("chart_weeks")
          .select("id,week_start")
          .eq("id", data.weekId)
          .eq("status", "published")
          .eq("source", "lastfm")
          .maybeSingle();
        if (requestedWeekError) throw requestedWeekError;
        week = requestedWeek;
      }

      if (data.weekId !== undefined && !week) {
        throw new Error(`Published chart week ${data.weekId} is unavailable`);
      }
      const availableWeeks =
        week && !weeks.some((candidate) => candidate.id === week!.id)
          ? [...weeks, week].sort((a, b) => b.week_start.localeCompare(a.week_start))
          : weeks;

      if (week) {
        const { data: entries, error: entriesError } = await db
          .from("chart_entries")
          .select(
            "rank,prev_rank,peak_rank,weeks_on_chart,songboard_score,chart_score,people_score,momentum_score,streaming_score,radio_score,social_score,search_score,song:songs(id,slug,title,hue,genre_id,country_code,release_date,duration_sec,artist:artists(id,slug,name,hue))",
          )
          .eq("week_id", week.id)
          .order("rank");
        if (entriesError) throw entriesError;

        const snapshotRows: ChartRow[] = [];
        const validEntries = (entries ?? []).filter((entry) => entry.song);
        for (let i = 0; i < validEntries.length; i += 8) {
          const batch = await Promise.all(
            validEntries.slice(i, i + 8).map(async (entry) => {
              const song = entry.song as ChartRow["song"];
              const image = await fetchTrackCover(song.artist?.name ?? "", song.title).catch(
                () => null,
              );
              return {
                rank: entry.rank,
                prev_rank: entry.prev_rank,
                peak_rank: entry.peak_rank,
                weeks_on_chart: entry.weeks_on_chart,
                songboard_score: Number(entry.songboard_score),
                chart_score: Number(entry.chart_score),
                people_score: Number(entry.people_score),
                momentum_score: Number(entry.momentum_score),
                streaming_score: Number(entry.streaming_score),
                radio_score: Number(entry.radio_score),
                social_score: Number(entry.social_score),
                search_score: Number(entry.search_score),
                song: { ...song, image },
              };
            }),
          );
          snapshotRows.push(...batch);
        }
        return { week, weeks: availableWeeks, rows: snapshotRows, genres, countries, live: false };
      }
    } catch (error) {
      if (data.weekId !== undefined) throw error;
      console.warn(
        "[getChart] Published snapshot lookup unavailable; serving live preview:",
        error instanceof Error ? error.message : String(error),
      );
    }

    // Live Last.fm results remain a preview until a weekly snapshot is published.
    const liveRows = (await fetchLiveChartRows(100)) as unknown as ChartRow[];
    const liveWeek = { id: 0, week_start: new Date().toISOString().slice(0, 10) };
    return { week: liveWeek, weeks: [liveWeek], rows: liveRows, genres, countries, live: true };
  });

export const getSong = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const db = publicDb();
    const { data: song } = await db
      .from("songs")
      .select(`${SONG_SEL},album:albums(title),genre:genres(name),country:countries(name,flag)`)
      .eq("slug", data.slug)
      .maybeSingle();
    if (song) {
      const { data: publishedWeeks, error: weeksError } = await db
        .from("chart_weeks")
        .select("id")
        .eq("status", "published")
        .eq("source", "lastfm");
      if (weeksError) throw weeksError;
      const weekIds = (publishedWeeks ?? []).map((w) => w.id);
      const historyRequest = weekIds.length
        ? db
            .from("chart_entries")
            .select(
              "week_id,rank,songboard_score,chart_score,people_score,momentum_score,streaming_score,radio_score,social_score,search_score,prev_rank,peak_rank,weeks_on_chart,week:chart_weeks(week_start)",
            )
            .eq("song_id", song.id)
            .in("week_id", weekIds)
            .order("week_id")
        : Promise.resolve({ data: [], error: null });
      const metricsRequest = weekIds.length
        ? db
            .from("song_metrics")
            .select("week_id,streaming,radio,social,search,people_up,people_down")
            .eq("song_id", song.id)
            .in("week_id", weekIds)
            .order("week_id")
        : Promise.resolve({ data: [], error: null });
      const [
        { data: history, error: historyError },
        { data: metrics, error: metricsError },
        { data: totals, error: totalsError },
        image,
      ] = await Promise.all([
        historyRequest,
        metricsRequest,
        db.rpc("vote_totals"),
        fetchTrackCover(String(song.artist?.name ?? ""), song.title).catch(() => null),
      ]);
      if (historyError) throw historyError;
      if (metricsError) throw metricsError;
      if (totalsError) throw totalsError;
      const live = (totals ?? []).find((t) => t.song_id === song.id);
      const { data: related } = await db
        .from("songs")
        .select(SONG_SEL)
        .eq("genre_id", song.genre_id ?? "")
        .neq("id", song.id)
        .limit(6);
      const relatedRows = (related ?? []).map((s) => ({ ...s, image: null as string | null }));
      for (let i = 0; i < relatedRows.length; i += 3) {
        await Promise.all(
          relatedRows.slice(i, i + 3).map(async (s) => {
            s.image = await fetchTrackCover(String(s.artist?.name ?? ""), s.title).catch(
              () => null,
            );
          }),
        );
      }
      return {
        song: { ...song, image },
        history: history ?? [],
        metrics: metrics ?? [],
        live: { up: Number(live?.up ?? 0), down: Number(live?.down ?? 0) },
        related: relatedRows,
      };
    }
    // LIVE FALLBACK: resolve song detail from real Last.fm rows (no fake data).
    try {
      const liveRows = await fetchLiveChartRows(100);
      const match = liveRows.find((r) => r.song.slug === data.slug);
      if (!match) return null;
      const related = liveRows
        .filter((r) => r.song.slug !== data.slug)
        .slice(0, 6)
        .map((r) => r.song);
      return {
        song: { ...match.song, album: null, genre: null, country: null },
        history: [
          {
            week_id: 0,
            rank: match.rank,
            songboard_score: match.songboard_score,
            chart_score: match.chart_score,
            people_score: match.people_score,
            momentum_score: match.momentum_score,
            streaming_score: match.streaming_score,
            radio_score: match.radio_score,
            social_score: match.social_score,
            search_score: match.search_score,
            prev_rank: null,
            peak_rank: match.rank,
            weeks_on_chart: 1,
            week: { week_start: new Date().toISOString().slice(0, 10) },
          },
        ],
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
    const { data: artist } = await db
      .from("artists")
      .select("*,genre:genres(name),country:countries(name,flag)")
      .eq("slug", data.slug)
      .maybeSingle();
    if (artist) {
      const { data: publishedWeeks, error: weeksError } = await db
        .from("chart_weeks")
        .select("id")
        .eq("status", "published")
        .eq("source", "lastfm");
      if (weeksError) throw weeksError;
      const weekIds = (publishedWeeks ?? []).map((w) => w.id);
      const imageP = fetchArtistImage(artist.name).catch(() => null);
      const { data: songs, error: songsError } = await db
        .from("songs")
        .select(`${SONG_SEL},album:albums(title)`)
        .eq("artist_id", artist.id)
        .order("release_date", { ascending: false });
      if (songsError) throw songsError;
      const ids = (songs ?? []).map((s) => s.id);
      const { data: entries, error: entriesError } =
        ids.length && weekIds.length
          ? await db
              .from("chart_entries")
              .select("week_id,song_id,rank,songboard_score,peak_rank,weeks_on_chart")
              .in("song_id", ids)
              .in("week_id", weekIds)
              .order("week_id")
          : { data: [], error: null };
      if (entriesError) throw entriesError;
      const rows = (songs ?? []).map((s) => ({ ...s, image: null as string | null }));
      for (let i = 0; i < Math.min(rows.length, 12); i += 4) {
        await Promise.all(
          rows.slice(i, i + 4).map(async (s) => {
            s.image = await fetchTrackCover(String(s.artist?.name ?? ""), s.title).catch(
              () => null,
            );
          }),
        );
      }
      return { artist: { ...artist, image: await imageP }, songs: rows, entries: entries ?? [] };
    }
    // LIVE FALLBACKS: 1) chart rows (fast, rich chart context), 2) direct
    // Last.fm lookup by de-slugified name so ANY slug resolves with real data.
    try {
      const liveRows = await fetchLiveChartRows(100);
      const mine = liveRows.filter((r) => r.song.artist.slug === data.slug);
      if (mine.length) {
        const first = mine[0]!.song.artist;
        return {
          artist: {
            id: first.id,
            slug: first.slug,
            name: first.name,
            hue: first.hue,
            image: await fetchArtistImage(first.name).catch(() => null),
            genre: null,
            country: null,
            bio: null,
            monthly_listeners: 0,
          },
          songs: mine.map((r) => ({ ...r.song, album: null })),
          entries: mine.map((r) => ({
            week_id: 0,
            song_id: r.song.id,
            rank: r.rank,
            songboard_score: r.songboard_score,
            peak_rank: r.rank,
            weeks_on_chart: 1,
          })),
        };
      }
    } catch {
      /* fall through to Last.fm lookup */
    }
    try {
      const guess = decodeURIComponent(data.slug).replace(/-/g, " ").trim();
      const live = await resolveArtistByName(guess || data.slug, 10);
      return {
        artist: {
          id: live.artist.slug,
          slug: live.artist.slug,
          name: live.artist.name,
          hue: live.artist.hue,
          image: live.artist.image,
          genre: null,
          country: null,
          bio: live.artist.bio,
          monthly_listeners: live.artist.listeners,
        },
        songs: live.songs.map((s, i) => ({
          id: `${live.artist.slug}::${s.title.toLowerCase()}`,
          slug: `${live.artist.slug}-${s.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")
            .slice(0, 60)}`,
          title: s.title,
          hue: live.artist.hue,
          image: s.cover,
          genre_id: null,
          country_code: null,
          release_date: s.year ? `${s.year}-01-01` : null,
          duration_sec: s.durationSec ?? 200,
          artist: {
            id: live.artist.slug,
            slug: live.artist.slug,
            name: live.artist.name,
            hue: live.artist.hue,
          },
          album: s.album ? { title: s.album } : null,
        })),
        entries: live.songs
          .map((s, i) =>
            s.chartRank
              ? {
                  week_id: 0,
                  song_id: `${live.artist.slug}::${s.title.toLowerCase()}`,
                  rank: s.chartRank,
                  songboard_score: s.chartScore ?? 0,
                  peak_rank: s.chartRank,
                  weeks_on_chart: 1,
                }
              : null,
          )
          .filter((e): e is NonNullable<typeof e> => e !== null),
      };
    } catch (error) {
      if (error instanceof ArtistNotFoundError) return null;
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
    db
      .from("battles")
      .select(
        `id,a:songs!battles_song_a_fkey(${SONG_SEL}),b:songs!battles_song_b_fkey(${SONG_SEL})`,
      )
      .order("created_at", { ascending: false })
      .limit(12),
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

export type WeeklyArtist = {
  rank: number;
  name: string;
  slug: string;
  hue: number;
  image: string | null;
  score: number;
  bestRank: number;
  trackCount: number;
  weeksOnChart: number;
};

/**
 * WEEKLY Top Artists — aggregates the published weekly SONGBOARD snapshot
 * (same chart_weeks/chart_entries week as getChart) by artist. There is no
 * Last.fm weekly-artists endpoint, so the weekly artist chart is honestly
 * derived from our own published week: total songboard_score across the
 * artist's tracks, best track rank, track count.
 */
export const getWeeklyTopArtists = createServerFn({ method: "GET" })
  .inputValidator((d: { weekId?: number } | undefined) =>
    z.object({ weekId: z.number().int().optional() }).parse(d ?? {}),
  )
  .handler(
    async ({
      data,
    }): Promise<{
      week: { id: number; week_start: string } | null;
      artists: WeeklyArtist[];
      live: boolean;
    }> => {
      try {
        const db = publicDb();
        const { data: publishedWeeks, error: weeksError } = await db
          .from("chart_weeks")
          .select("id,week_start")
          .eq("status", "published")
          .eq("source", "lastfm")
          .order("week_start", { ascending: false })
          .limit(52);
        if (weeksError) throw weeksError;
        const weeks = publishedWeeks ?? [];
        const week =
          data.weekId === undefined
            ? (weeks[0] ?? null)
            : (weeks.find((w) => w.id === data.weekId) ?? null);
        if (week) {
          const { data: entries, error: entriesError } = await db
            .from("chart_entries")
            .select(
              "rank,weeks_on_chart,songboard_score,song:songs(id,artist:artists(id,slug,name,hue))",
            )
            .eq("week_id", week.id)
            .order("rank");
          if (entriesError) throw entriesError;
          const byArtist = new Map<string, WeeklyArtist & { _woc: number }>();
          for (const entry of entries ?? []) {
            const artist = (
              entry as {
                song?: {
                  artist?: { id: string; slug: string; name: string; hue: number } | null;
                } | null;
              }
            ).song?.artist;
            if (!artist) continue;
            const cur = byArtist.get(artist.id);
            if (!cur) {
              byArtist.set(artist.id, {
                rank: 0,
                name: artist.name,
                slug: artist.slug,
                hue: artist.hue,
                image: null,
                score: Number((entry as { songboard_score?: number }).songboard_score ?? 0),
                bestRank: (entry as { rank: number }).rank,
                trackCount: 1,
                weeksOnChart: Number((entry as { weeks_on_chart?: number }).weeks_on_chart ?? 1),
                _woc: Number((entry as { weeks_on_chart?: number }).weeks_on_chart ?? 1),
              });
            } else {
              cur.score += Number((entry as { songboard_score?: number }).songboard_score ?? 0);
              cur.bestRank = Math.min(cur.bestRank, (entry as { rank: number }).rank);
              cur.trackCount += 1;
              cur._woc = Math.max(
                cur._woc,
                Number((entry as { weeks_on_chart?: number }).weeks_on_chart ?? 1),
              );
              cur.weeksOnChart = cur._woc;
            }
          }
          const artists = [...byArtist.values()]
            .sort((a, b) => b.score - a.score || a.bestRank - b.bestRank)
            .slice(0, 100)
            .map((a, i) => ({ ...a, rank: i + 1 }));
          for (let i = 0; i < Math.min(artists.length, 24); i += 6) {
            await Promise.all(
              artists.slice(i, i + 6).map(async (a) => {
                a.image = await fetchArtistImage(a.name).catch(() => null);
              }),
            );
          }
          return { week, artists, live: false };
        }
      } catch (error) {
        if (data.weekId !== undefined) throw error;
        console.warn(
          "[getWeeklyTopArtists] snapshot unavailable; serving live fallback:",
          error instanceof Error ? error.message : String(error),
        );
      }
      // Live fallback: aggregate the live chart rows by artist.
      const liveRows = await fetchLiveChartRows(100);
      const byName = new Map<string, WeeklyArtist>();
      for (const r of liveRows) {
        const nm = r.song.artist.name;
        const cur = byName.get(nm.toLowerCase());
        if (!cur) {
          byName.set(nm.toLowerCase(), {
            rank: 0,
            name: nm,
            slug: r.song.artist.slug,
            hue: r.song.artist.hue,
            image: null,
            score: r.songboard_score,
            bestRank: r.rank,
            trackCount: 1,
            weeksOnChart: 1,
          });
        } else {
          cur.score += r.songboard_score;
          cur.bestRank = Math.min(cur.bestRank, r.rank);
          cur.trackCount += 1;
        }
      }
      const artists = [...byName.values()]
        .sort((a, b) => b.score - a.score)
        .map((a, i) => ({ ...a, rank: i + 1 }));
      return {
        week: { id: 0, week_start: new Date().toISOString().slice(0, 10) },
        artists,
        live: true,
      };
    },
  );
