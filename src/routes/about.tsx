import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, Compass, MessageCircle, Sparkles } from "lucide-react";

const pillars = [
  {
    icon: BarChart3,
    title: "Charts",
    description: "A clear view of what is performing and how each song is moving.",
  },
  {
    icon: MessageCircle,
    title: "Public opinion",
    description: "A place for listeners to add their perspective to the conversation.",
  },
  {
    icon: Compass,
    title: "Music discovery",
    description: "Explore artists, genres, countries and songs beyond the familiar.",
  },
  {
    icon: Sparkles,
    title: "Music intelligence",
    description: "Context that helps make chart movement easier to understand.",
  },
];

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About SONGBOARD" },
      {
        name: "description",
        content: "SONGBOARD is where music performance and public opinion meet.",
      },
      { property: "og:title", content: "About SONGBOARD" },
      { property: "og:description", content: "Where the numbers meet the people." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-16 md:px-6">
      <section className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Our point of view
        </p>
        <h1 className="mt-3 text-5xl font-extrabold md:text-7xl">
          Where the numbers meet the people.
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
          SONGBOARD brings music performance and listener opinion together. It is a place to see
          what is rising, explore the artists behind it and make sense of how a chart changes.
        </p>
      </section>
      <section
        className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Product pillars"
      >
        {pillars.map(({ icon: Icon, title, description }) => (
          <article key={title} className="rounded-xl border bg-card p-5">
            <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
            <h2 className="mt-4 text-xl font-bold">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
          </article>
        ))}
      </section>
      <Link
        to="/charts"
        search={{ tab: "tracks", period: "weekly" }}
        className="mt-10 inline-flex items-center gap-2 text-sm font-semibold text-primary"
      >
        Explore the charts <ArrowRight className="h-4 w-4" />
      </Link>
    </main>
  );
}
