import { createFileRoute } from "@tanstack/react-router";
import { SectionHeader } from "@/components/sb/bits";

const dimensions = [
  {
    title: "Performance Score",
    description:
      "The current engine normalizes streaming, radio, social and search inputs to the chart cohort, then combines them using the configured weights. Default weights are 40%, 25%, 10% and 5%, respectively.",
    label: "Configured formula",
  },
  {
    title: "People Score",
    description:
      "The engine currently uses max-normalized positive votes minus half of negative votes. Its default overall-chart weight is 20%. Live-provider charts currently supply proxy values rather than verified public votes.",
    label: "Configured formula",
  },
  {
    title: "Momentum",
    description:
      "When a previous score exists, momentum is clamped to 0–100 around a neutral value of 50, moving four points for each point of overall score gained or lost. New entries start at 60.",
    label: "Current engine rule",
  },
  {
    title: "Overall Chart Score",
    description:
      "The current default weighted score combines streaming (40%), radio (25%), people (20%), social (10%) and search (5%). Administrators can configure these weights.",
    label: "Current default weights",
  },
];

export const Route = createFileRoute("/methodology")({
  head: () => ({
    meta: [
      { title: "Chart Methodology — SONGBOARD" },
      {
        name: "description",
        content: "How SONGBOARD explains chart performance, public opinion and momentum.",
      },
      { property: "og:title", content: "Chart Methodology — SONGBOARD" },
      {
        property: "og:description",
        content: "An overview of the SONGBOARD chart dimensions and what is still being refined.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MethodologyPage,
});

function MethodologyPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-14 md:px-6">
      <SectionHeader
        as="h1"
        kicker="How to read the chart"
        title="Methodology"
        description="The chart is designed to bring measurable performance and public opinion into one understandable view."
      />
      <div className="mb-8 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm text-muted-foreground">
        Methodology note: the formulas describe the current chart engine, not a finalized industry
        standard. In the live Last.fm adapter, some inputs are derived proxies (including the People
        Score); they are not direct streaming, radio or verified vote totals. Provider coverage and
        proxy inputs should be treated as provisional.
      </div>
      <div className="mb-8 rounded-xl border bg-card p-4 text-sm leading-relaxed text-muted-foreground">
        Weekly charts become historical only after a complete snapshot is published. Until then,
        Last.fm results are shown as a live preview and are not counted as chart history or
        week-over-week movement. Synthetic sample weeks and unverified legacy weeks are excluded
        from published chart history. Published snapshots are immutable.
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {dimensions.map((dimension) => (
          <article key={dimension.title} className="rounded-xl border bg-card p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              {dimension.label}
            </p>
            <h2 className="mt-2 text-2xl font-bold">{dimension.title}</h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">{dimension.description}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
