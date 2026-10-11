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
export const Route = createFileRoute("/people")({
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(q).catch(() => null);
  },
  head: () => ({
    meta: [
      { title: "People's Chart — SONGBOARD" },
      {
        name: "description",
        content: "Explore SONGBOARD's community sentiment chart and listener voting.",
      },
      { property: "og:title", content: "People's Chart — SONGBOARD" },
      {
        property: "og:description",
        content: "Explore listener sentiment and community voting on SONGBOARD.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});
function Page() {
  const { data } = useQuery(q);
  if (!data) return null;
  const rows = [...data.rows].sort((a, b) => b.people_score - a.people_score);
  return (
    <main className="mx-auto max-w-6xl px-4 py-12 md:px-6">
      <SectionHeader
        as="h1"
        kicker="Public opinion"
        title="People's Chart"
        description="This view is ordered by the People Score currently supplied by the chart data. Votes are stored in this browser and do not yet feed the global score."
      />
      {rows.map((r, i) => (
        <ChartRow key={r.song.id} r={r} rankOverride={i + 1} />
      ))}
    </main>
  );
}
