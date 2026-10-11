import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";
import { Suspense, lazy } from "react";
import { BarChart3, Calendar, Clock, Radio, TrendingUp, Users } from "lucide-react";
import { getSong } from "@/lib/charts.functions";
import { Cover, LiveBadge, ScoreBar, ShareButton, StatCard } from "@/components/sb/bits";
import { VoteButtons, FollowButton } from "@/components/sb/vote";
import { ListenSection } from "@/components/sb/listen";

const ChartHistory = lazy(() => import("@/components/sb/chart-history"));
const LyricsSection = lazy(() =>
  import("@/components/sb/lyrics").then((m) => ({ default: m.LyricsSection })),
);

const opts = (slug: string) =>
  queryOptions({
    queryKey: ["song", slug],
    queryFn: () => getSong({ data: { slug } }),
    placeholderData: keepPreviousData,
  });
export const Route = createFileRoute("/song/$slug")({
  loader: ({ context, params }) => {
    // Prefetch in background; the page renders from cache instantly (or a
    // light state) and true misses still 404 once the fetch resolves.
    void context.queryClient.prefetchQuery(opts(params.slug)).catch(() => null);
  },
  head: ({ params }) => {
    const t = "Song";
    const a = "SONGBOARD";
    const description = `Chart position, performance, public sentiment and history for ${t} by ${a}.`;
    return {
      meta: [
        { title: `${t} by ${a} — SONGBOARD` },
        { name: "description", content: description },
        { property: "og:title", content: `${t} by ${a} — SONGBOARD` },
        { property: "og:description", content: description },
        { property: "og:type", content: "music.song" },
        { name: "twitter:title", content: `${t} by ${a} — SONGBOARD` },
        { name: "twitter:description", content: description },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: `/song/${encodeURIComponent(params.slug)}` }],
    };
  },
  component: Page,
  notFoundComponent: () => (
    <main className="mx-auto max-w-3xl p-12">
      <h1 className="text-4xl font-bold">Song not found</h1>
    </main>
  ),
});
function Page() {
  const { slug } = Route.useParams();
  const { data, isPending } = useQuery(opts(slug));
  if (isPending && !data) return null;
  if (!data) throw notFound();
  const { song, history, metrics, live, related } = data;
  const latest = history.at(-1);
  const latestMetrics = metrics.at(-1);
  const chart = history.map((h, i) => ({
    week: (h.week as { week_start: string }).week_start.slice(5),
    rank: h.rank,
    score: Number(h.songboard_score),
    people: Number(h.people_score),
    momentum: Number(h.momentum_score),
    i,
  }));
  return (
    <main>
      <section className="border-b">
        <div className="mx-auto grid max-w-7xl items-end gap-10 px-4 py-12 md:grid-cols-[360px_1fr] md:px-6">
          <Cover
            src={song.image}
            resolve={{ artist: song.artist.name, track: song.title }}
            hue={song.hue}
            title={song.title}
            size={360}
            className="!h-auto w-full aspect-square shadow-2xl"
          />
          <div>
            {latest?.week_id === 0 ? (
              <LiveBadge />
            ) : latest ? (
              <span className="rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                Published weekly snapshot
              </span>
            ) : (
              <span className="rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                Not yet on a published chart
              </span>
            )}
            <div className="mt-6 text-xs uppercase tracking-[.2em] text-primary">
              #{latest?.rank ?? "—"} Global
            </div>
            <h1 className="mt-2 text-5xl font-extrabold md:text-7xl">{song.title}</h1>
            <Link
              to="/artist/$slug"
              params={{ slug: song.artist.slug }}
              className="mt-3 inline-block text-2xl text-muted-foreground hover:text-primary"
            >
              {song.artist.name}
            </Link>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span>
                Previous rank:{" "}
                <strong className="text-foreground">
                  {latest?.prev_rank ? `#${latest.prev_rank}` : "—"}
                </strong>
              </span>
              <span>
                Peak:{" "}
                <strong className="text-foreground">
                  {latest?.peak_rank ? `#${latest.peak_rank}` : "—"}
                </strong>
              </span>
              <span>
                Weeks on chart:{" "}
                <strong className="text-foreground">{latest?.weeks_on_chart ?? "—"}</strong>
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {song.release_date ?? "Release date unavailable"}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {Math.floor(song.duration_sec / 60)}:
                {String(song.duration_sec % 60).padStart(2, "0")}
              </span>
              <span>{song.genre?.name}</span>
              <span>
                {song.country?.flag} {song.country?.name}
              </span>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <VoteButtons songId={song.id} />
              <FollowButton type="song" id={song.id} />
              <ShareButton title={`${song.title} by ${song.artist.name}`} />
            </div>
          </div>
        </div>
      </section>
      <div className="mx-auto max-w-7xl px-4 py-14 md:px-6">
        <section>
          <h2 className="mb-6 text-3xl font-bold">Score breakdown</h2>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Overall score"
              value={Number(latest?.songboard_score ?? 0).toFixed(1)}
              tone="primary"
            />
            <StatCard label="Current rank" value={latest?.rank ? `#${latest.rank}` : "—"} />
            <StatCard label="Peak rank" value={latest?.peak_rank ? `#${latest.peak_rank}` : "—"} />
            <StatCard label="Weeks on chart" value={latest?.weeks_on_chart ?? "—"} />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <ScoreCard
              icon={<Radio />}
              label="Performance Score"
              value={Number(latest?.chart_score ?? 0)}
              tone="primary"
              text="Listening and reach signals across the chart."
            />
            <ScoreCard
              icon={<Users />}
              label="People Score"
              value={Number(latest?.people_score ?? 0)}
              tone="people"
              text="Votes and provider proxy inputs; see methodology."
            />
            <ScoreCard
              icon={<TrendingUp />}
              label="Momentum"
              value={Number(latest?.momentum_score ?? 0)}
              tone="momentum"
              text="How quickly this song is gaining ground."
            />
          </div>
          <div className="mt-5 grid gap-4 rounded-lg border bg-card p-5 md:grid-cols-4">
            <ScoreBar label="Streaming" value={Number(latest?.streaming_score ?? 0)} />
            <ScoreBar label="Radio" value={Number(latest?.radio_score ?? 0)} />
            <ScoreBar label="Social" value={Number(latest?.social_score ?? 0)} />
            <ScoreBar label="Search" value={Number(latest?.search_score ?? 0)} />
          </div>
        </section>
        <section className="mt-16">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <div className="text-xs uppercase tracking-[.2em] text-primary">
                Chart position over time
              </div>
              <h2 className="text-3xl font-bold">Chart history</h2>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              Peak <strong className="text-foreground">#{latest?.peak_rank}</strong> ·{" "}
              {latest?.weeks_on_chart} weeks
            </div>
          </div>
          {chart.length > 1 ? (
            <div className="h-80 rounded-lg border bg-card p-4">
              <Suspense fallback={<div className="shimmer h-full w-full rounded" />}>
                <ChartHistory chart={chart} />
              </Suspense>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
              {history.length
                ? "Historical chart data is accumulating; only one published snapshot is available."
                : "Historical chart data is accumulating. This song does not yet have a published chart entry."}
            </div>
          )}
        </section>
        <Suspense fallback={<div className="shimmer mt-16 h-64 w-full rounded-lg" />}>
          <LyricsSection
            artist={song.artist.name}
            track={song.title}
            album={song.album?.title ?? null}
            duration={song.duration_sec ?? null}
          />
        </Suspense>
        <ListenSection artist={song.artist.name} track={song.title} />
        <section className="mt-16 grid gap-8 md:grid-cols-2">
          <div className="rounded-lg border p-6">
            <div className="flex items-center gap-2 text-people">
              <Users className="h-5 w-5" />
              <h2 className="text-2xl font-bold text-foreground">Public sentiment</h2>
            </div>
            <div className="mt-7 flex items-end gap-5">
              <div>
                <div className="tabular text-5xl font-bold text-people">
                  {Number(latest?.people_score ?? 0).toFixed(0)}
                </div>
                <div className="text-sm text-muted-foreground">People Score</div>
              </div>
              <div className="pb-1 text-sm text-muted-foreground">
                Live votes: <strong className="text-up">+{live.up}</strong> ·{" "}
                <strong className="text-down">−{live.down}</strong>
              </div>
            </div>
          </div>
          <div className="rounded-lg border p-6">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <h2 className="text-2xl font-bold">Raw reach</h2>
            </div>
            <div className="mt-7 grid grid-cols-2 gap-5 text-sm">
              {latestMetrics && (
                <>
                  <Metric
                    label="Streams"
                    value={Number(latestMetrics.streaming).toLocaleString()}
                  />
                  <Metric
                    label="Radio spins"
                    value={Number(latestMetrics.radio).toLocaleString()}
                  />
                  <Metric
                    label="Social signals"
                    value={Number(latestMetrics.social).toLocaleString()}
                  />
                  <Metric label="Searches" value={Number(latestMetrics.search).toLocaleString()} />
                </>
              )}
            </div>
          </div>
        </section>
        <section className="mt-16">
          <h2 className="mb-5 text-3xl font-bold">Related songs</h2>
          {related.length === 0 ? (
            <p className="text-sm text-muted-foreground">Related songs are not available yet.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((r) => (
                <Link
                  to="/song/$slug"
                  params={{ slug: r.slug }}
                  key={r.id}
                  className="flex items-center gap-3 rounded-lg border p-3 hover:border-primary"
                >
                  <Cover
                    src={r.image}
                    resolve={{ artist: r.artist.name, track: r.title }}
                    hue={r.hue}
                    title={r.title}
                    size={48}
                  />
                  <div>
                    <div className="font-semibold">{r.title}</div>
                    <div className="text-sm text-muted-foreground">{r.artist.name}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
function ScoreCard({
  icon,
  label,
  value,
  tone,
  text,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "primary" | "people" | "momentum";
  text: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex items-center gap-2 text-muted-foreground [&>svg]:h-4 [&>svg]:w-4">
        {icon}
        <span className="text-xs uppercase tracking-wider">{label}</span>
      </div>
      <div className="my-3 tabular text-4xl font-bold">{value.toFixed(1)}</div>
      <ScoreBar label={text} value={value} tone={tone} />
    </div>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="tabular text-xl font-bold">{value}</div>
      <div className="text-muted-foreground">{label}</div>
    </div>
  );
}
