import { createFileRoute, Link } from "@tanstack/react-router";
import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";
import { ArrowRight, Compass, Sparkles, TrendingUp } from "lucide-react";
import { getChart } from "@/lib/charts.functions";
import { TrackCard } from "@/components/sb/chart-row";
import { GenreCard } from "@/components/sb/browse";
import {
  Cover,
  LiveBadge,
  MomentumBadge,
  RankBadge,
  SectionHeader,
  StatCard,
} from "@/components/sb/bits";
import { VoteButtons } from "@/components/sb/vote";

const chartQuery = queryOptions({
  queryKey: ["chart", "latest"],
  queryFn: () => getChart({ data: {} }),
  staleTime: 5 * 60 * 1000,
  placeholderData: keepPreviousData,
});

export const Route = createFileRoute("/")({
  // Fire-and-forget: navigation renders instantly from cache (or a light
  // inline state) while fresh data streams in — never block on the server.
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(chartQuery).catch(() => null);
  },
  head: () => ({
    meta: [
      { title: "SONGBOARD — Where the Numbers Meet the People" },
      { name: "description", content: "Discover what is rising. Decide what deserves the crown." },
      { property: "og:title", content: "SONGBOARD — Where the Numbers Meet the People" },
      {
        property: "og:description",
        content: "Discover what is rising. Decide what deserves the crown.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const { data, isPending } = useQuery(chartQuery);
  if (isPending && !data) return <HomeSkeleton />;
  if (!data) return <HomeSkeleton />;
  const top = data.rows[0];
  if (!top) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-16 md:px-6">
        <h1 className="text-5xl font-extrabold">SONGBOARD</h1>
        <p className="mt-3 text-muted-foreground">Where the numbers meet the people.</p>
        <p className="mt-8 text-muted-foreground">
          Chart data is unavailable right now. Please try again shortly.
        </p>
      </main>
    );
  }

  const movers = [...data.rows].sort((a, b) => b.momentum_score - a.momentum_score).slice(0, 5);
  const people = [...data.rows].sort((a, b) => b.people_score - a.people_score).slice(0, 5);
  const rising = [...data.rows].sort((a, b) => b.momentum_score - a.momentum_score).slice(0, 6);
  const underRadar = [...data.rows]
    .slice(20)
    .sort((a, b) => b.momentum_score - a.momentum_score)
    .slice(0, 5);
  const artists = [
    ...new Map(data.rows.map((row) => [row.song.artist.slug, row.song.artist])).values(),
  ].slice(0, 8);

  return (
    <main>
      <section className="relative overflow-hidden border-b">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background: `radial-gradient(circle at 75% 15%, oklch(0.55 0.18 ${top.song.hue}) 0%, transparent 48%)`,
          }}
        />
        <div className="relative mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-24">
          <div className="max-w-3xl">
            <LiveBadge />
            <h1 className="mt-5 text-6xl font-extrabold leading-[0.95] md:text-8xl">SONGBOARD</h1>
            <p className="mt-4 text-2xl font-semibold md:text-3xl">
              Where the numbers meet the people.
            </p>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Discover what is rising. Decide what deserves the crown.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                to="/charts"
                search={{ tab: "tracks", period: "weekly" }}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
              >
                Explore the charts <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/discover"
                className="inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold hover:border-primary"
              >
                Discover music <Compass className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-16 px-4 py-12 md:space-y-20 md:px-6 md:py-16">
        <section aria-labelledby="current-number-one">
          <SectionHeader kicker="The latest chart" title="Current #1">
            <Link
              to="/charts"
              search={{ tab: "tracks", period: "weekly" }}
              className="inline-flex items-center gap-1 text-sm text-primary"
            >
              Weekly Top Tracks <ArrowRight className="h-4 w-4" />
            </Link>
          </SectionHeader>
          <article className="grid gap-6 rounded-2xl border bg-card p-5 md:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)] md:items-center md:p-8">
            <div className="flex min-w-0 items-center gap-5">
              <RankBadge rank={top.rank} className="text-4xl text-primary md:text-5xl" />
              <Link to="/song/$slug" params={{ slug: top.song.slug }} className="shrink-0">
                <Cover
                  src={top.song.image}
                  resolve={{ artist: top.song.artist.name, track: top.song.title }}
                  hue={top.song.hue}
                  title={top.song.title}
                  size={88}
                />
              </Link>
              <div className="min-w-0">
                <Link
                  to="/song/$slug"
                  params={{ slug: top.song.slug }}
                  className="block truncate text-2xl font-bold hover:text-primary md:text-3xl"
                  id="current-number-one"
                >
                  {top.song.title}
                </Link>
                <Link
                  to="/artists/$name"
                  params={{ name: top.song.artist.name }}
                  className="mt-1 block truncate text-muted-foreground hover:text-primary"
                >
                  {top.song.artist.name}
                </Link>
                <p className="mt-2 text-xs text-muted-foreground">
                  Peak #{top.peak_rank} · {top.weeks_on_chart} weeks on chart
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-5 md:border-l md:border-t-0 md:pl-6 md:pt-0">
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <StatCard label="Overall" value={top.songboard_score.toFixed(0)} tone="primary" />
                <StatCard label="Chart" value={top.chart_score.toFixed(0)} />
                <StatCard label="People" value={top.people_score.toFixed(0)} tone="people" />
                <StatCard label="Momentum" value={top.momentum_score.toFixed(0)} tone="momentum" />
              </div>
              <VoteButtons songId={top.song.id} />
            </div>
          </article>
        </section>

        <section>
          <SectionHeader kicker="This week" title="Global Top 10">
            <Link
              to="/charts"
              search={{ tab: "tracks", period: "weekly" }}
              className="inline-flex items-center gap-1 text-sm text-primary"
            >
              View full charts <ArrowRight className="h-4 w-4" />
            </Link>
          </SectionHeader>
          <div className="border-t">
            {data.rows.slice(0, 10).map((row) => (
              <TrackCard key={row.song.id} r={row} />
            ))}
          </div>
        </section>

        <section className="grid gap-12 lg:grid-cols-2">
          <div>
            <SectionHeader kicker="Momentum" title="Biggest movers" />
            <div className="border-t">
              {movers.map((row) => (
                <TrackCard key={row.song.id} r={row} showScores={false} />
              ))}
            </div>
            <SectionLink to="/movers">All movers</SectionLink>
          </div>
          <div>
            <SectionHeader kicker="Your voice" title="People's Chart" />
            <div className="border-t">
              {people.map((row, index) => (
                <TrackCard key={row.song.id} r={row} rankOverride={index + 1} showScores={false} />
              ))}
            </div>
            <SectionLink to="/people">Full People's Chart</SectionLink>
          </div>
        </section>

        <section>
          <SectionHeader kicker="Rising fast" title="Gaining momentum">
            <Link to="/trending" className="inline-flex items-center gap-1 text-sm text-primary">
              See trending <ArrowRight className="h-4 w-4" />
            </Link>
          </SectionHeader>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rising.map((row) => (
              <Link
                key={row.song.id}
                to="/song/$slug"
                params={{ slug: row.song.slug }}
                className="flex min-w-0 items-center gap-3 rounded-xl border bg-card p-4 hover:border-primary"
              >
                <Cover
                  src={row.song.image}
                  resolve={{ artist: row.song.artist.name, track: row.song.title }}
                  hue={row.song.hue}
                  title={row.song.title}
                  size={56}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{row.song.title}</div>
                  <div className="truncate text-sm text-muted-foreground">
                    {row.song.artist.name}
                  </div>
                  <div className="mt-2">
                    <MomentumBadge value={row.momentum_score} />
                  </div>
                </div>
                <TrendingUp className="h-4 w-4 shrink-0 text-momentum" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>

        <section>
          <SectionHeader
            kicker="Worth another listen"
            title="Under the radar"
            description="Songs outside the current Top 20 that are showing signs of momentum."
          />
          <div className="border-t">
            {underRadar.map((row) => (
              <TrackCard key={row.song.id} r={row} showScores={false} />
            ))}
          </div>
        </section>

        <section>
          <SectionHeader kicker="Explore" title="Browse genres">
            <Link to="/genres" className="inline-flex items-center gap-1 text-sm text-primary">
              All genres <ArrowRight className="h-4 w-4" />
            </Link>
          </SectionHeader>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {data.genres.slice(0, 12).map((genre) => (
              <GenreCard key={genre.id} {...genre} />
            ))}
          </div>
        </section>

        <section>
          <SectionHeader kicker="Meet the music" title="Browse artists">
            <Link to="/artists" className="inline-flex items-center gap-1 text-sm text-primary">
              All artists <ArrowRight className="h-4 w-4" />
            </Link>
          </SectionHeader>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {artists.map((artist) => (
              <Link
                key={artist.slug}
                to="/artists/$name"
                params={{ name: artist.name }}
                className="rounded-xl border bg-card p-4 font-semibold transition hover:border-primary"
              >
                <div className="truncate">{artist.name}</div>
                <div className="mt-2 text-xs font-normal text-muted-foreground">View artist →</div>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-primary/25 bg-primary/5 p-6 md:p-9">
          <div className="flex items-start gap-4">
            <Sparkles className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                On the roadmap
              </p>
              <h2 className="mt-2 text-2xl font-bold md:text-3xl">
                A little more insight, in time.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Music intelligence and personalized discovery are future directions for SONGBOARD.
                AI features are not available yet.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function SectionLink({ to, children }: { to: "/movers" | "/people"; children: React.ReactNode }) {
  return (
    <Link to={to} className="mt-4 inline-flex items-center gap-1 text-sm text-primary">
      {children} <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

function HomeSkeleton() {
  return (
    <main className="anim-rise">
      <section className="border-b">
        <div className="mx-auto max-w-7xl px-4 py-20 md:px-6">
          <div className="shimmer h-5 w-40 rounded" />
          <div className="shimmer mt-5 h-20 w-2/3 rounded-lg" />
          <div className="shimmer mt-4 h-7 w-1/2 rounded" />
        </div>
      </section>
      <div className="mx-auto max-w-7xl space-y-4 px-4 py-14 md:px-6">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="shimmer h-16 rounded-md" />
        ))}
      </div>
    </main>
  );
}
