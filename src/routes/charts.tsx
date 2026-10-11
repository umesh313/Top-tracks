import { createFileRoute, Link } from "@tanstack/react-router";
import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";
import { Suspense, useState } from "react";
import { getChart, getWeeklyTopArtists } from "@/lib/charts.functions";
import { fmtPlays, getDailyTopArtists, getDailyTopTracks } from "@/lib/artists.functions";
import { ArtistRow, ChartRow } from "@/components/sb/chart-row";
import { BrowseTrackRow } from "@/components/sb/browse";
import { ErrorState, LiveBadge, LoadingState } from "@/components/sb/bits";

type Tab = "tracks" | "artists";
type Period = "daily" | "weekly";

const weeklyTracksQ = queryOptions({
  queryKey: ["chart", "latest"],
  queryFn: () => getChart({ data: {} }),
  staleTime: 15 * 60 * 1000,
  placeholderData: keepPreviousData,
});
const weeklyArtistsQ = queryOptions({
  queryKey: ["charts", "weekly-artists"],
  queryFn: () => getWeeklyTopArtists({ data: {} }),
  staleTime: 15 * 60 * 1000,
  placeholderData: keepPreviousData,
});
const dailyTracksQ = queryOptions({
  queryKey: ["charts", "daily-tracks"],
  queryFn: () => getDailyTopTracks({ data: { limit: 100 } }),
  staleTime: 5 * 60 * 1000,
  placeholderData: keepPreviousData,
});
const dailyArtistsQ = queryOptions({
  queryKey: ["charts", "daily-artists"],
  queryFn: () => getDailyTopArtists({ data: { limit: 100 } }),
  staleTime: 5 * 60 * 1000,
  placeholderData: keepPreviousData,
});

export const Route = createFileRoute("/charts")({
  validateSearch: (s: Record<string, unknown>) => ({
    tab: (s["tab"] === "artists" ? "artists" : "tracks") as Tab,
    period: (s["period"] === "daily" ? "daily" : "weekly") as Period,
  }),
  loaderDeps: ({ search }) => ({ tab: search.tab, period: search.period }),
  loader: ({ context, deps }) => {
    const q =
      deps.tab === "artists" && deps.period === "daily"
        ? dailyArtistsQ
        : deps.tab === "tracks" && deps.period === "daily"
          ? dailyTracksQ
          : deps.tab === "artists"
            ? weeklyArtistsQ
            : weeklyTracksQ;
    // Fresh call: passing the union of queryOptions directly breaks
    // prefetchQuery's generic inference under exactOptionalPropertyTypes.
    // Data type is irrelevant here — the component's typed useQuery reads it.
    void context.queryClient
      .prefetchQuery({ queryKey: q.queryKey, queryFn: q.queryFn as () => Promise<unknown> })
      .catch(() => null);
  },
  head: () => ({
    meta: [
      { title: "Charts — SONGBOARD" },
      { name: "description", content: "Top tracks and top artists, daily and weekly." },
    ],
  }),
  component: Page,
});

const TABS: { id: Tab; label: string }[] = [
  { id: "tracks", label: "Top Tracks" },
  { id: "artists", label: "Top Artists" },
];
const PERIODS: { id: Period; label: string }[] = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
];

function tabCls(active: boolean) {
  return `rounded-full px-5 py-2 text-sm font-semibold transition ${
    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
  }`;
}

function Meta({ live, stamp, note }: { live: boolean; stamp: string; note: string }) {
  return (
    <div className="mb-6">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {live ? (
          <LiveBadge />
        ) : (
          <span className="rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
            Published weekly snapshot
          </span>
        )}
        <span className="text-xs uppercase tracking-widest text-muted-foreground">{stamp}</span>
      </div>
      <p className="text-muted-foreground">{note}</p>
    </div>
  );
}

function Page() {
  const { tab, period } = Route.useSearch();
  return (
    <main className="mx-auto max-w-7xl px-4 py-12 md:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Global charts</p>
      <h1 className="mt-2 text-5xl font-extrabold md:text-7xl">Charts</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Top tracks and top artists — live daily snapshots plus the published weekly chart.
      </p>
      <div className="mt-7 flex flex-wrap items-center gap-3">
        <div
          role="tablist"
          aria-label="Chart type"
          className="inline-flex rounded-full border bg-card p-1"
        >
          {TABS.map((t) => (
            <Link
              key={t.id}
              to="."
              search={{ tab: t.id, period }}
              role="tab"
              aria-selected={tab === t.id}
              className={tabCls(tab === t.id)}
            >
              {t.label}
            </Link>
          ))}
        </div>
        <div
          role="tablist"
          aria-label="Chart period"
          className="inline-flex rounded-full border bg-card p-1"
        >
          {PERIODS.map((p) => (
            <Link
              key={p.id}
              to="."
              search={{ tab, period: p.id }}
              role="tab"
              aria-selected={period === p.id}
              className={tabCls(period === p.id)}
            >
              {p.label}
            </Link>
          ))}
        </div>
      </div>
      <div className="mt-8" role="tabpanel">
        <Suspense fallback={<LoadingState label="Loading chart…" />}>
          {tab === "tracks" && period === "weekly" && <WeeklyTracks />}
          {tab === "tracks" && period === "daily" && <DailyTracks />}
          {tab === "artists" && period === "weekly" && <WeeklyArtists />}
          {tab === "artists" && period === "daily" && <DailyArtists />}
        </Suspense>
      </div>
    </main>
  );
}

function WeeklyTracks() {
  const { data } = useQuery(weeklyTracksQ);
  const [genre, setGenre] = useState("all");
  if (!data) return <LoadingState label="Loading chart…" />;
  const rows = genre === "all" ? data.rows : data.rows.filter((r) => r.song.genre_id === genre);
  return (
    <section>
      <Meta
        live={data.live}
        stamp={data.live ? "Live preview" : `Week of ${data.week?.week_start}`}
        note="Provider data. People. Momentum. One transparent rank."
      />
      <div className="mb-4 flex justify-end">
        <select
          aria-label="Filter by genre"
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
          className="rounded-md border bg-card px-4 py-2 text-sm"
        >
          <option value="all">All genres</option>
          {data.genres.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>
      <div className="border-t">
        {rows.map((r) => (
          <ChartRow key={r.song.id} r={r} />
        ))}
      </div>
    </section>
  );
}

function DailyTracks() {
  const { data, error, refetch } = useQuery(dailyTracksQ);
  if (!data) {
    if (error)
      return (
        <ErrorState
          title={error instanceof Error ? error.message : "Daily tracks unavailable."}
          onRetry={() => void refetch()}
        />
      );
    return <LoadingState label="Loading chart…" />;
  }
  return (
    <section>
      <Meta
        live
        stamp={`Updated ${new Date(data.fetchedAt).toLocaleString()}`}
        note="The 100 songs charting globally on Last.fm right now."
      />
      <div className="border-t">
        {data.tracks.map((t) => (
          <BrowseTrackRow key={`${t.rank}-${t.title}-${t.artist}`} t={t} offset={0} />
        ))}
      </div>
    </section>
  );
}

function WeeklyArtists() {
  const { data } = useQuery(weeklyArtistsQ);
  if (!data) return <LoadingState label="Loading chart…" />;
  return (
    <section>
      <Meta
        live={data.live}
        stamp={data.live ? "Live preview" : `Week of ${data.week?.week_start}`}
        note="Artists ranked by total SONGBOARD score across their charting tracks."
      />
      <div className="border-t">
        {data.artists.map((a) => (
          <ArtistRow
            key={a.slug}
            rank={a.rank}
            name={a.name}
            image={a.image}
            hue={a.hue}
            stat1={fmtPlays(Math.round(a.score))}
            stat1Label="Score"
            stat2={`#${a.bestRank}`}
            stat2Label="Best track"
            detail={`${a.trackCount} track${a.trackCount === 1 ? "" : "s"} on chart`}
          />
        ))}
      </div>
    </section>
  );
}

function DailyArtists() {
  const { data, error, refetch } = useQuery(dailyArtistsQ);
  if (!data) {
    if (error)
      return (
        <ErrorState
          title={error instanceof Error ? error.message : "Daily artists unavailable."}
          onRetry={() => void refetch()}
        />
      );
    return <LoadingState label="Loading chart…" />;
  }
  return (
    <section>
      <Meta
        live
        stamp={`Updated ${new Date(data.fetchedAt).toLocaleString()}`}
        note="The 100 artists charting globally on Last.fm right now."
      />
      <div className="border-t">
        {data.artists.map((a) => (
          <ArtistRow
            key={a.slug}
            rank={a.rank}
            name={a.name}
            image={a.image}
            hue={a.hue}
            stat1={fmtPlays(a.listeners)}
            stat1Label="Listeners"
            stat2={fmtPlays(a.playcount)}
            stat2Label="Plays"
          />
        ))}
      </div>
    </section>
  );
}
