import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getChart } from "@/lib/charts.functions";
import { ChartRow } from "@/components/sb/chart-row";
import { DemoBadge } from "@/components/sb/bits";

const q = queryOptions({ queryKey: ["chart", "all"], queryFn: () => getChart({ data: {} }) });

export const Route = createFileRoute("/charts")({
  loader: ({ context }) => context.queryClient.ensureQueryData(q),
  head: () => ({
    meta: [
      { title: "Global Top 100 — SONGBOARD" },
      { name: "description", content: "The weekly Global Top 100 ranked by performance and people." },
    ],
  }),
  component: Page,
});

function Page() {
  const { data } = useSuspenseQuery(q);
  const [genre, setGenre] = useState("all");
  const rows = genre === "all" ? data.rows : data.rows.filter((r) => r.song.genre_id === genre);
  return (
    <main className="mx-auto max-w-7xl px-4 py-12 md:px-6">
      <div className="mb-9 flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="mb-2 flex gap-2">
            <DemoBadge />
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Week of {data.week?.week_start}</span>
          </div>
          <h1 className="text-5xl font-extrabold md:text-7xl">Global Top 100</h1>
          <p className="mt-3 text-muted-foreground">Streaming. Radio. People. Momentum. One definitive rank.</p>
        </div>
        <select aria-label="Filter by genre" value={genre} onChange={(e) => setGenre(e.target.value)} className="rounded-md border bg-card px-4 py-2 text-sm">
          <option value="all">All genres</option>
          {data.genres.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </div>
      <div className="border-t">
        {rows.map((r) => (
        <ChartRow key={r.song.id} r={r} />
      ))}
      </div>
    </main>
  );
}

