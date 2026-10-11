import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { searchCatalog } from "@/lib/charts.functions";
import { fmtPlays } from "@/lib/artists.functions";
import { Cover } from "@/components/sb/bits";

export const Route = createFileRoute("/search")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search["q"] === "string" ? search["q"] : "",
  }),
  head: () => ({
    meta: [
      { title: "Search Music — SONGBOARD" },
      { name: "description", content: "Search songs and artists on Last.fm." },
      { property: "og:title", content: "Search — SONGBOARD" },
      { property: "og:description", content: "Find songs and artists on Last.fm." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  const { q } = Route.useSearch();
  const navigate = Route.useNavigate();
  const searchFn = useServerFn(searchCatalog);
  const [term, setTerm] = useState(q);
  const normalizedTerm = term.trim();

  useEffect(() => setTerm(q), [q]);

  const results = useQuery({
    queryKey: ["search", normalizedTerm],
    queryFn: () => searchFn({ data: { q: normalizedTerm } }),
    enabled: normalizedTerm.length >= 2,
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  return (
    <main className="mx-auto min-h-[70vh] max-w-5xl px-4 py-12 md:px-6">
      <h1 className="text-5xl font-extrabold">Search songs and artists</h1>
      <p className="mt-3 text-muted-foreground">Search the live Last.fm catalog.</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void navigate({ to: ".", search: { q: normalizedTerm } });
        }}
        className="relative mt-8"
        role="search"
      >
        <input
          name="q"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          autoFocus
          autoComplete="off"
          placeholder="Search songs or artists"
          aria-label="Search songs or artists"
          className="h-14 w-full rounded-lg border bg-card pl-4 pr-14 text-lg outline-none focus:border-primary"
        />
        <button
          type="submit"
          aria-label="Search Last.fm"
          className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-md hover:bg-accent"
        >
          <Search className="h-5 w-5" />
        </button>
      </form>

      {normalizedTerm.length < 2 ? (
        <p className="mt-8 text-sm text-muted-foreground">Enter at least 2 characters to search.</p>
      ) : results.isPending ? (
        <p className="mt-8 text-sm text-muted-foreground" role="status">
          Searching songs and artists…
        </p>
      ) : results.isError ? (
        <div className="mt-8 rounded-lg border border-destructive/30 p-4" role="alert">
          <p className="text-sm text-destructive">
            {results.error instanceof Error
              ? results.error.message
              : "Search failed. Please try again."}
          </p>
          <button
            type="button"
            onClick={() => void results.refetch()}
            className="mt-3 rounded-md border px-3 py-1.5 text-sm hover:border-primary"
          >
            Retry search
          </button>
        </div>
      ) : results.data ? (
        <div className="mt-10 space-y-10">
          <section aria-labelledby="song-results-heading">
            <h2 id="song-results-heading" className="mb-4 text-2xl font-bold">
              Songs{" "}
              <span className="text-base font-normal text-muted-foreground">
                ({results.data.songs.length})
              </span>
            </h2>
            {results.data.songs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No songs found for “{normalizedTerm}”.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {results.data.songs.map((song) => (
                  <article
                    key={song.id}
                    className="flex min-w-0 items-center gap-3 rounded-lg border p-3"
                  >
                    <Cover
                      src={song.image}
                      resolve={{ artist: song.artist.name, track: song.title }}
                      hue={song.hue}
                      title={song.title}
                    />
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{song.title}</div>
                      <Link
                        to="/artists/$name"
                        params={{ name: song.artist.name }}
                        className="block truncate text-sm text-muted-foreground hover:text-primary"
                      >
                        {song.artist.name}
                      </Link>
                      <div className="mt-1 text-xs text-muted-foreground tabular">
                        {fmtPlays(song.playcount)} plays · {fmtPlays(song.listeners)} listeners
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section aria-labelledby="artist-results-heading">
            <h2 id="artist-results-heading" className="mb-4 text-2xl font-bold">
              Artists{" "}
              <span className="text-base font-normal text-muted-foreground">
                ({results.data.artists.length})
              </span>
            </h2>
            {results.data.artists.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No artists found for “{normalizedTerm}”.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {results.data.artists.map((artist) => (
                  <Link
                    to="/artists/$name"
                    params={{ name: artist.name }}
                    key={artist.id}
                    className="flex min-w-0 items-center gap-3 rounded-lg border p-3 hover:border-primary"
                  >
                    <Cover src={artist.image} hue={artist.hue} title={artist.name} />
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{artist.name}</div>
                      <div className="text-sm text-muted-foreground tabular">
                        {fmtPlays(artist.listeners)} listeners
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : null}
    </main>
  );
}
