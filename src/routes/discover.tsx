import { createFileRoute, Link } from "@tanstack/react-router";
import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { getChart } from "@/lib/charts.functions";
import { ChartRow } from "@/components/sb/chart-row";
import { SectionHeader } from "@/components/sb/bits";

const chartQuery = queryOptions({
  queryKey: ["chart", "latest"],
  queryFn: () => getChart({ data: {} }),
  staleTime: 5 * 60 * 1000,
  placeholderData: keepPreviousData,
});

export const Route = createFileRoute("/discover")({
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(chartQuery).catch(() => null);
  },
  head: () => ({
    meta: [
      { title: "Discover Music — SONGBOARD" },
      {
        name: "description",
        content: "Discover rising songs, artists and sounds across SONGBOARD.",
      },
      { property: "og:title", content: "Discover Music — SONGBOARD" },
      { property: "og:description", content: "Explore rising songs, artists, genres and charts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DiscoverPage,
});

function DiscoverPage() {
  const { data } = useQuery(chartQuery);
  if (!data) return null;
  const rising = [...data.rows].sort((a, b) => b.momentum_score - a.momentum_score).slice(0, 8);
  return (
    <main className="mx-auto max-w-7xl px-4 py-12 md:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
        Find your next favorite
      </p>
      <h1 className="mt-2 text-5xl font-extrabold md:text-7xl">Discover</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        Follow what is rising or explore music by artist, genre and chart.
      </p>
      <section className="mt-12">
        <SectionHeader kicker="Rising fast" title="Songs picking up momentum">
          <Link to="/trending" className="inline-flex items-center gap-1 text-sm text-primary">
            Trending now <ArrowRight className="h-4 w-4" />
          </Link>
        </SectionHeader>
        <div className="border-t">
          {rising.map((row) => (
            <ChartRow key={row.song.id} r={row} />
          ))}
        </div>
      </section>
      <section className="mt-14">
        <SectionHeader kicker="Explore" title="Choose a path" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { to: "/artists", label: "Artists", description: "Browse artist pages and top songs." },
            { to: "/genres", label: "Genres", description: "Explore charts by sound." },
            {
              to: "/countries",
              label: "Countries",
              description: "See what listeners are playing around the world.",
            },
            {
              to: "/charts",
              label: "Charts",
              description: "Top tracks and top artists, daily and weekly.",
            },
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-xl border bg-card p-5 transition hover:border-primary"
            >
              <h2 className="font-bold">{item.label}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
