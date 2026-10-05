import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { browseGenreTracks, GENRE_TAGS } from "@/lib/artists.functions";

type Preview = { tag: string; top: { title: string; artist: string }[] };

async function fetchPreviews(): Promise<Preview[]> {
  const out: Preview[] = [];
  for (let i = 0; i < GENRE_TAGS.length; i += 4) {
    const chunk = GENRE_TAGS.slice(i, i + 4);
    const res = await Promise.allSettled(chunk.map((g) => browseGenreTracks({ data: { tag: g.id, page: 1 } })));
    res.forEach((r, j) => {
      const g = chunk[j]!;
      out.push({ tag: g.id, top: r.status === "fulfilled" ? r.value.tracks.slice(0, 3).map((t) => ({ title: t.title, artist: t.artist })) : [] });
    });
  }
  return out;
}

const q = queryOptions({ queryKey: ["genres", "list"], queryFn: fetchPreviews, staleTime: 10 * 60 * 1000 });

export const Route = createFileRoute("/genres")({
  loader: ({ context }) => context.queryClient.ensureQueryData(q).catch(() => [] as Preview[]),
  pendingComponent: () => (
    <main className="mx-auto max-w-7xl px-4 py-12 md:px-6">
      <div className="shimmer h-12 w-64 rounded-lg" />
      <div className="shimmer mt-8 h-10 w-full max-w-md rounded-lg" />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 12 }).map((_, i) => <div key={i} className="shimmer h-44 rounded-lg" />)}
      </div>
    </main>
  ),
  head: () => ({ meta: [{ title: "Genre Charts — SONGBOARD" }, { name: "description", content: "Explore trending songs by genre — pop, hip-hop, rock, latin, electronic and more." }, { property: "og:title", content: "Genre Charts — SONGBOARD" }, { property: "og:description", content: "Every sound has its own leaderboard." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Page,
});

function Page() {
  const previews = useSuspenseQuery(q);
  const [filter, setFilter] = useState("");
  const list = useMemo(() => GENRE_TAGS.filter((g) => g.name.toLowerCase().includes(filter.trim().toLowerCase())), [filter]);
  const topOf = (tag: string) => previews.data?.find((p) => p.tag === tag)?.top ?? [];
  return (
    <main className="anim-rise mx-auto max-w-7xl px-4 py-12 md:px-6">
      <h1 className="text-5xl font-extrabold md:text-7xl">Genre charts</h1>
      <p className="mt-3 text-muted-foreground">Every sound has its own leaderboard — tap a genre to see its trending songs.</p>
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter genres…"
        aria-label="Filter genres"
        className="mt-6 h-10 w-full max-w-md rounded-md border bg-card px-3 text-sm outline-none focus:border-primary"
      />
      {list.length === 0 ? (
        <p className="mt-10 text-muted-foreground">No genres match “{filter}”.</p>
      ) : (
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((g) => {
            const top = topOf(g.id);
            return (
              <Link key={g.id} to="/genres/$genre" params={{ genre: g.id }} preload="intent" className="overflow-hidden rounded-lg border bg-card transition hover:border-primary">
                <div className="h-28 p-5" style={{ background: `linear-gradient(135deg,oklch(.5 .16 ${g.hue}),transparent)` }}>
                  <h2 className="text-3xl font-bold">{g.name}</h2>
                </div>
                <div className="p-5">
                  {top.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Open the {g.name} chart →</p>
                  ) : (
                    top.map((t, i) => (
                      <div key={i} className="flex gap-3 py-2 text-sm">
                        <span className="tabular text-muted-foreground">{i + 1}</span>
                        <div className="min-w-0">
                          <div className="truncate font-medium">{t.title}</div>
                          <div className="truncate text-xs text-muted-foreground">{t.artist}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
