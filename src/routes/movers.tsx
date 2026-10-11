import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";
import { getChart } from "@/lib/charts.functions";
import { ChartRow } from "@/components/sb/chart-row";
import { SectionHeader } from "@/components/sb/bits";

const q = queryOptions({
  queryKey: ["chart", "latest"],
  queryFn: () => getChart({ data: {} }),
  staleTime: 5 * 60 * 1000,
  placeholderData: keepPreviousData,
});
export const Route = createFileRoute("/movers")({
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(q).catch(() => null);
  },
  head: () => ({
    meta: [
      { title: "Biggest Chart Movers — SONGBOARD" },
      { name: "description", content: "The week's biggest climbs and falls." },
      { property: "og:title", content: "Biggest Chart Movers — SONGBOARD" },
      { property: "og:description", content: "Track the biggest chart movements this week." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});
function Page() {
  const { data } = useQuery(q);
  if (!data) return null;
  const hasHistory = !data.live && data.rows.some((row) => row.prev_rank !== null);
  const surging = data.rows
    .filter((row) => row.prev_rank !== null && row.prev_rank > row.rank)
    .sort((a, b) => b.prev_rank! - b.rank - (a.prev_rank! - a.rank))
    .slice(0, 20);
  const cooling = data.rows
    .filter((row) => row.prev_rank !== null && row.prev_rank < row.rank)
    .sort((a, b) => a.prev_rank! - a.rank - (b.prev_rank! - b.rank))
    .slice(0, 20);
  return (
    <main className="mx-auto max-w-7xl px-4 py-12 md:px-6">
      <h1 className="text-5xl font-extrabold md:text-7xl">Biggest movers</h1>
      <p className="mt-3 text-muted-foreground">
        {hasHistory
          ? `Week-over-week rank changes for the chart published ${data.week.week_start}.`
          : "Historical chart movement is accumulating. Live previews are not treated as week-over-week movement."}
      </p>
      {hasHistory ? (
        <div className="mt-12 grid gap-14 lg:grid-cols-2">
          <section>
            <SectionHeader kicker="Rank movement" title="Biggest climbs" />
            {surging.map((r) => (
              <ChartRow key={r.song.id} r={r} showScores={false} />
            ))}
          </section>
          <section>
            <SectionHeader kicker="Rank movement" title="Biggest falls" />
            {cooling.map((r) => (
              <ChartRow key={r.song.id} r={r} showScores={false} />
            ))}
          </section>
        </div>
      ) : null}
    </main>
  );
}
