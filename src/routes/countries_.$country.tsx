import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";
import { browseCountryTracks, COUNTRY_LIST } from "@/lib/artists.functions";
import { BrowseTrackRow, Pager } from "@/components/sb/browse";

const pageSearch = (s: Record<string, unknown>): { page?: number } =>
  typeof s["page"] === "number" && s["page"] > 1
    ? { page: Math.min(20, Math.floor(s["page"])) }
    : {};
const qFor = (code: string, page: number) =>
  queryOptions({
    queryKey: ["countries", "tracks", code, page],
    queryFn: () => browseCountryTracks({ data: { code, page } }),
    staleTime: 10 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

export const Route = createFileRoute("/countries_/$country")({
  validateSearch: pageSearch,
  loader: ({ context, params, location }) => {
    if (!COUNTRY_LIST.some((c) => c.code === params.country.toUpperCase())) throw notFound();
    void context.queryClient
      .prefetchQuery(qFor(params.country.toUpperCase(), pageSearch(location.search).page ?? 1))
      .catch(() => null);
  },
  notFoundComponent: () => (
    <main className="mx-auto max-w-3xl px-4 py-24 text-center">
      <h1 className="text-4xl font-extrabold">Unknown country</h1>
      <p className="mt-4 text-muted-foreground">That country isn't in our coverage yet.</p>
      <Link to="/countries" className="mt-6 inline-block text-primary hover:underline">
        ← Back to all countries
      </Link>
    </main>
  ),
  head: ({ params }) => ({
    meta: [
      { title: `${params.country} Music Chart — SONGBOARD` },
      { name: "description", content: "The trending songs in this country right now." },
      { property: "og:title", content: `${params.country} Music Chart — SONGBOARD` },
      { property: "og:description", content: "The trending songs in this country right now." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function CountrySkeleton() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-12 md:px-6">
      <div className="shimmer h-16 w-72 rounded-lg" />
      <div className="mt-6 flex gap-2 overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="shimmer h-9 w-24 shrink-0 rounded-full" />
        ))}
      </div>
      <div className="mt-10 grid gap-8 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="shimmer h-16 rounded-lg" />
          ))}
        </div>
        <div className="shimmer h-80 rounded-lg" />
      </div>
    </main>
  );
}

function Page() {
  const { country } = Route.useParams();
  const { page: pageRaw } = Route.useSearch();
  const page = pageRaw ?? 1;
  const code = country.toUpperCase();
  const { data, isPending } = useQuery(qFor(code, page));
  if (isPending && !data) return <CountrySkeleton />;
  const offset = (page - 1) * 24;
  return (
    <main className="anim-rise mx-auto max-w-6xl px-4 py-12 md:px-6">
      <div className="text-6xl">
        {data?.flag ?? COUNTRY_LIST.find((c) => c.code === code)?.flag}
      </div>
      <h1 className="mt-2 text-6xl font-extrabold">
        {data?.name ?? COUNTRY_LIST.find((c) => c.code === code)?.name}
      </h1>
      <p className="mt-3 text-muted-foreground">
        Trending songs right now on Last.fm
        {data ? ` — page ${data.page} of ${data.totalPages}` : ""}.
      </p>

      {/* Country switcher */}
      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Countries">
        {COUNTRY_LIST.map((c) => (
          <Link
            key={c.code}
            to="/countries/$country"
            params={{ country: c.code }}
            preload="intent"
            title={c.name}
            className={`rounded-full border px-3 py-1.5 text-sm transition hover:border-primary ${c.code === code ? "border-primary bg-primary/10 text-primary" : ""}`}
          >
            {c.flag} {c.code}
          </Link>
        ))}
      </nav>

      {!data ? (
        <p className="mt-10 text-muted-foreground">
          Couldn't load trending songs for this country right now. Try again in a moment.
        </p>
      ) : (
        <div className="mt-10 grid gap-8 lg:grid-cols-3">
          <section className="lg:col-span-2" aria-label="Trending tracks">
            {data.tracks.length === 0 ? (
              <p className="text-muted-foreground">No trending songs found on this page.</p>
            ) : (
              <>
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
                <Pager
                  page={data.page}
                  totalPages={data.totalPages}
                  makeSearch={(p) => ({ page: p === 1 ? undefined : p })}
                />
              </>
            )}
          </section>
          <aside aria-label="Top artists in this country">
            <h2 className="text-xl font-bold">Top artists here</h2>
            {data.topArtists.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Artist data loads on page 1.</p>
            ) : (
              <ol className="mt-3 space-y-2">
                {data.topArtists.map((a, i) => (
                  <li key={a} className="flex gap-3 text-sm">
                    <span className="w-5 tabular text-muted-foreground">{i + 1}</span>
                    <Link
                      to="/artists/$name"
                      params={{ name: a }}
                      preload="intent"
                      className="truncate font-medium hover:text-primary"
                    >
                      {a}
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}
