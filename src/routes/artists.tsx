import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { browseArtists } from "@/lib/artists.functions";
import { ArtistCard, ArtistSearch } from "@/components/sb/artist";
import { LiveBadge } from "@/components/sb/bits";
import { Pager } from "@/components/sb/browse";

const pageSearch = (s: Record<string, unknown>): { page?: number } =>
  typeof s["page"] === "number" && s["page"] > 1 ? { page: Math.min(500, Math.floor(s["page"])) } : {};
const qFor = (page: number) =>
  queryOptions({ queryKey: ["artists", "browse", page], queryFn: () => browseArtists({ data: { page } }), staleTime: 10 * 60 * 1000 });

export const Route = createFileRoute("/artists")({
  validateSearch: pageSearch,
  loader: ({ context, location }) =>
    context.queryClient.ensureQueryData(qFor(pageSearch(location.search).page ?? 1)).catch(() => null),
  pendingComponent: ArtistsSkeleton,
  head: () => ({ meta: [{ title: "Artists — SONGBOARD" }, { name: "description", content: "Browse every artist on Last.fm — search, filter, and page through the full database." }] }),
  component: Page,
});

function Page() {
  const { page: pageRaw } = Route.useSearch();
  const page = pageRaw ?? 1;
  const { data } = useSuspenseQuery(qFor(page));
  const [filter, setFilter] = useState("");
  const all = data?.artists ?? [];
  const artists = all.filter((a) => a.name.toLowerCase().includes(filter.trim().toLowerCase()));
  return (
    <main className="anim-rise mx-auto max-w-7xl px-4 py-12 md:px-6">
      <div className="mb-2 flex items-center gap-2">
        <LiveBadge />
        <span className="text-xs uppercase tracking-widest text-muted-foreground">Last.fm artist database</span>
      </div>
      <h1 className="text-5xl font-extrabold md:text-7xl">Artists</h1>
      <p className="mt-3 text-muted-foreground">Search any artist, or browse the full Last.fm database page by page.</p>
      <div className="mt-8"><ArtistSearch autoFocus /></div>
      <div className="mb-4 mt-12 flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-2xl font-bold md:text-3xl">
          All artists{data ? ` — page ${data.page} of ${data.totalPages} (${data.total.toLocaleString()} total)` : ""}
        </h2>
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter this page…" aria-label="Filter artists" className="h-10 w-56 rounded-md border bg-card px-3 text-sm outline-none focus:border-primary" />
      </div>
      {!data || all.length === 0 ? (
        <p className="text-muted-foreground">{!data ? "Artist data unavailable right now. Try searching above." : "No artists on this page."}</p>
      ) : artists.length === 0 ? (
        <p className="text-muted-foreground">No artists on this page match “{filter}”.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {artists.map((a) => <ArtistCard key={a.slug + a.name} a={a} />)}
        </div>
      )}
      {data && (
        <Pager
          page={data.page}
          totalPages={data.totalPages}
          makeSearch={(p) => ({ page: p === 1 ? undefined : p })}
        />
      )}
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Tip: use the search box above to jump straight to any artist — pagination covers the whole database.
      </p>
    </main>
  );
}

function ArtistsSkeleton() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-12 md:px-6">
      <div className="shimmer h-12 w-64 rounded-lg" />
      <div className="shimmer mt-8 h-14 w-full rounded-lg" />
      <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 9 }).map((_, i) => <div key={i} className="shimmer h-24 rounded-xl" />)}</div>
      <div className="shimmer mt-8 h-9 w-72 rounded-lg" />
    </main>
  );
}
