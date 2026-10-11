import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";
import { getTrendingTracks } from "@/lib/artists.functions";
import { BrowseTrackRow } from "@/components/sb/browse";
import { LiveBadge } from "@/components/sb/bits";

const q = queryOptions({
  queryKey: ["trending", "tracks"],
  queryFn: () => getTrendingTracks(),
  staleTime: 5 * 60 * 1000,
  placeholderData: keepPreviousData,
});

export const Route = createFileRoute("/trending")({
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(q).catch(() => null);
  },
  head: () => ({
    meta: [
      { title: "Trending Songs — SONGBOARD" },
      { name: "description", content: "Songs trending globally right now, updated from Last.fm." },
      { property: "og:title", content: "Trending Songs — SONGBOARD" },
      { property: "og:description", content: "See the songs trending globally right now." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  const { data } = useQuery(q);
  if (!data) return null;
  return (
    <main className="mx-auto max-w-6xl px-4 py-12 md:px-6">
      <div className="mb-2">
        <LiveBadge />
      </div>
      <h1 className="mt-3 text-5xl font-extrabold md:text-7xl">Trending now</h1>
      <p className="my-8 text-muted-foreground">
        The 50 songs trending globally right now on Last.fm.
      </p>
      {data.tracks.length === 0 ? (
        <p className="text-muted-foreground">
          No trending songs found right now. Try again in a moment.
        </p>
      ) : (
        <div className="border-t">
          {data.tracks.map((track, i) => (
            <BrowseTrackRow
              key={`${track.rank}-${track.title}-${track.artist}`}
              t={track}
              offset={i}
            />
          ))}
        </div>
      )}
    </main>
  );
}
