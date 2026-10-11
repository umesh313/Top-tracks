import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";
import { browseGenreTracks, GENRE_TAGS } from "@/lib/artists.functions";
import { BrowseTrackRow, Pager } from "@/components/sb/browse";

const pageSearch = (s: Record<string, unknown>): { page?: number } =>
  typeof s["page"] === "number" && s["page"] > 1
    ? { page: Math.min(20, Math.floor(s["page"])) }
    : {};
const qFor = (tag: string, page: number) =>
  queryOptions({
    queryKey: ["genres", "tracks", tag, page],
    queryFn: () => browseGenreTracks({ data: { tag, page } }),
    staleTime: 10 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

export const Route = createFileRoute("/genres_/$genre")({
  validateSearch: pageSearch,
  loader: ({ context, params, location }) => {
    if (!GENRE_TAGS.some((g) => g.id === params.genre)) throw notFound();
    void context.queryClient
      .prefetchQuery(qFor(params.genre, pageSearch(location.search).page ?? 1))
      .catch(() => null);
  },
  notFoundComponent: () => (
    <main className="mx-auto max-w-3xl px-4 py-24 text-center">
      <h1 className="text-4xl font-extrabold">Unknown genre</h1>
      <p className="mt-4 text-muted-foreground">That genre doesn't exist on SONGBOARD.</p>
      <Link to="/genres" className="mt-6 inline-block text-primary hover:underline">
        ← Back to all genres
      </Link>
    </main>
  ),
  head: ({ params }) => ({
    meta: [
      { title: `${params.genre} Songs — SONGBOARD` },
      {
        name: "description",
        content: `Trending ${params.genre} songs right now — updated from Last.fm.`,
      },
      { property: "og:title", content: `${params.genre} Songs — SONGBOARD` },
      { property: "og:description", content: `Trending ${params.genre} songs right now.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function GenreSkeleton() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-12 md:px-6">
      <div className="shimmer h-16 w-72 rounded-lg" />
      <div className="mt-6 flex gap-2 overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="shimmer h-9 w-24 shrink-0 rounded-full" />
        ))}
      </div>
      <div className="mt-10 space-y-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="shimmer h-16 rounded-lg" />
        ))}
      </div>
      <div className="shimmer mt-8 h-9 w-72 rounded-lg" />
    </main>
  );
}

function Page() {
  const { genre } = Route.useParams();
  const { page: pageRaw } = Route.useSearch();
  const page = pageRaw ?? 1;
  const { data, isPending } = useQuery(qFor(genre, page));
  if (isPending && !data) return <GenreSkeleton />;
  const meta = GENRE_TAGS.find((g) => g.id === genre)!;
  const offset = (page - 1) * 24;
  return (
    <main className="anim-rise mx-auto max-w-6xl px-4 py-12 md:px-6">
      <div className="text-xs uppercase tracking-[.2em] text-primary">Genre chart</div>
      <h1 className="mt-2 text-6xl font-extrabold">{meta.name}</h1>
      <p className="mt-3 text-muted-foreground">
        Trending {meta.name} songs on Last.fm
        {data ? ` — page ${data.page} of ${data.totalPages}` : ""}.
      </p>

      {/* Genre switcher */}
      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Genres">
        {GENRE_TAGS.map((g) => (
          <Link
            key={g.id}
            to="/genres/$genre"
            params={{ genre: g.id }}
            preload="intent"
            className={`rounded-full border px-4 py-1.5 text-sm transition hover:border-primary ${g.id === genre ? "border-primary bg-primary/10 text-primary" : ""}`}
          >
            {g.name}
          </Link>
        ))}
      </nav>

      {!data ? (
        <p className="mt-10 text-muted-foreground">
          Couldn't load {meta.name} songs right now. Try again in a moment.
        </p>
      ) : data.tracks.length === 0 ? (
        <p className="mt-10 text-muted-foreground">No {meta.name} songs found on this page.</p>
      ) : (
        <section className="mt-10" aria-label={`${meta.name} trending tracks`}>
          <div className="flex items-center gap-4 border-b pb-2 text-xs uppercase tracking-widest text-muted-foreground">
            <span className="w-8 text-right">#</span>
            <span className="w-12" />
            <span className="flex-1">Song</span>
            <span className="hidden w-40 text-right sm:block">Plays</span>
            <span className="w-14 text-right">Time</span>
          </div>
          {data.tracks.map((t) => (
            <BrowseTrackRow key={`${t.rank}-${t.title}`} t={t} offset={offset} />
          ))}
        </section>
      )}

      {data && (
        <Pager
          page={data.page}
          totalPages={data.totalPages}
          makeSearch={(p) => ({ page: p === 1 ? undefined : p })}
        />
      )}
    </main>
  );
}
