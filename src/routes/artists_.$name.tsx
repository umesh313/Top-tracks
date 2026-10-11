import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getArtistTopSongs, ArtistNotFoundError } from "@/lib/artists.functions";
import { fmtPlays } from "@/lib/artists.functions";
import { ArtistSearch } from "@/components/sb/artist";
import { Cover, LiveBadge, ScoreBar, ShareButton, StatCard } from "@/components/sb/bits";

const opts = (name: string, limit: number) => {
  const n = decodeURIComponent(name).trim();
  return queryOptions({
    queryKey: ["artist-top", n, limit],
    queryFn: () => getArtistTopSongs({ data: { name: n, limit } }),
    staleTime: 10 * 60 * 1000,
    placeholderData: keepPreviousData,
    retry: 1,
  });
};

export const Route = createFileRoute("/artists_/$name")({
  loader: ({ context, params }) => {
    // Prefetch only — genuine unknown artists 404 from the component once
    // the fetch resolves; transient errors show the error boundary instead.
    void context.queryClient.prefetchQuery(opts(params.name, 10)).catch(() => null);
  },
  notFoundComponent: Missing,
  head: ({ params }) => {
    const artistName = decodeURIComponent(params.name).trim() || "Artist";
    const description = `Explore ${artistName}'s audience, top songs and chart presence on SONGBOARD.`;
    return {
      meta: [
        { title: `${artistName} — Top Songs | SONGBOARD` },
        { name: "description", content: description },
        { property: "og:title", content: `${artistName} — SONGBOARD` },
        { property: "og:description", content: description },
        { property: "og:type", content: "profile" },
        { name: "twitter:title", content: `${artistName} — Top Songs | SONGBOARD` },
        { name: "twitter:description", content: description },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: `/artists/${encodeURIComponent(artistName)}` }],
    };
  },
  component: Page,
});

function Page() {
  const { name } = Route.useParams();
  const [limit, setLimit] = useState(10);
  const [imgErr, setImgErr] = useState(false);
  const { data, isPending } = useQuery(opts(name, limit));
  // Render from cache instantly; only a genuine miss (fetch settled, no data)
  // becomes a 404. Transient errors surface via the error boundary, never a
  // false "not found".
  if (isPending && !data) return null;
  if (!data) throw notFound();
  const a = data.artist;
  return (
    <main>
      <section className="relative overflow-hidden border-b">
        <div className="relative mx-auto flex max-w-7xl flex-col gap-8 px-4 py-12 md:flex-row md:items-end md:px-6">
          {a.image && !imgErr ? (
            <img
              src={a.image}
              alt={a.name}
              onError={() => setImgErr(true)}
              referrerPolicy="no-referrer"
              className="h-48 w-48 rounded-full object-cover shadow-2xl"
            />
          ) : (
            <Cover hue={a.hue} title={a.name} size={190} className="rounded-full" />
          )}
          <div className="min-w-0">
            <LiveBadge />
            <h1 className="mt-2 text-5xl font-extrabold md:text-7xl">{a.name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground tabular">
              <span>
                <strong className="text-foreground">{fmtPlays(a.listeners)}</strong> listeners
              </span>
              <span>·</span>
              <span>
                <strong className="text-foreground">{fmtPlays(a.playcount)}</strong> plays
              </span>
            </div>
            {a.bio && (
              <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{a.bio.slice(0, 280)}</p>
            )}
            <div className="mt-4">
              <ShareButton title={`${a.name} on SONGBOARD`} />
            </div>
            <div className="mt-4 max-w-md">
              <ScoreBar
                label="Chart presence"
                value={Math.min(100, data.songs.filter((s) => s.chartRank).length * 10)}
                tone="primary"
              />
            </div>
          </div>
        </div>
      </section>
      <div className="mx-auto max-w-6xl px-4 py-10 md:px-6">
        <section
          className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
          aria-label="Artist overview"
        >
          <StatCard label="Listeners" value={fmtPlays(a.listeners)} />
          <StatCard label="Lifetime plays" value={fmtPlays(a.playcount)} tone="primary" />
          <StatCard label="Top songs" value={data.songs.length} />
          <StatCard
            label="Songs currently charting"
            value={data.songs.filter((song) => song.chartRank !== null).length}
            tone="people"
          />
          <StatCard
            label="Artist momentum"
            value="—"
            detail="Artist-level trend not available yet."
            tone="momentum"
          />
        </section>
        <div className="mb-5">
          <ArtistSearch />
        </div>
        {data.songs.some((song) => song.chartRank !== null) && (
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold">Songs currently charting</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {data.songs
                .filter((song) => song.chartRank !== null)
                .map((song) => (
                  <div
                    key={`${song.title}-${song.chartRank}`}
                    className="flex items-center gap-3 rounded-lg border p-3"
                  >
                    <Cover
                      src={song.cover}
                      resolve={{ artist: a.name, track: song.title }}
                      hue={a.hue}
                      title={song.title}
                    />
                    <span className="min-w-0 flex-1 truncate font-semibold">{song.title}</span>
                    <span className="shrink-0 text-sm font-bold text-primary">
                      #{song.chartRank}
                    </span>
                  </div>
                ))}
            </div>
          </section>
        )}
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-3xl font-bold">Best songs</h2>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Show
            <select
              aria-label="Number of top songs"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="rounded-md border bg-card px-3 py-1.5 text-sm text-foreground"
            >
              <option value={5}>Top 5</option>
              <option value={10}>Top 10</option>
              <option value={20}>Top 20</option>
            </select>
          </label>
        </div>
        <div className="border-t">
          {data.songs.map((s, i) => (
            <div
              key={s.title + i}
              className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 border-b border-border/60 py-3 md:grid-cols-[3rem_1fr_10rem_4rem_4.5rem_6rem_5rem] md:gap-4"
            >
              <div className="text-center font-display text-2xl font-extrabold tabular md:text-3xl">
                {i + 1}
              </div>
              <div className="flex min-w-0 items-center gap-3">
                {s.cover ? (
                  <SongCover src={s.cover} title={s.title} hue={a.hue} />
                ) : (
                  <Cover
                    resolve={{ artist: a.name, track: s.title }}
                    hue={a.hue}
                    title={s.title}
                    size={52}
                  />
                )}
                <div className="min-w-0">
                  <div className="truncate font-semibold">{s.title}</div>
                  <div className="truncate text-sm text-muted-foreground">
                    {s.album ?? "Single"}
                  </div>
                </div>
              </div>
              <div className="hidden text-sm text-muted-foreground md:block">
                <span className="text-[10px] uppercase tracking-wider">Album</span>
                <div className="truncate text-foreground">{s.album ?? "—"}</div>
              </div>
              <div className="hidden text-right md:block">
                <div className="tabular text-sm font-semibold">{s.year ?? "—"}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Year
                </div>
              </div>
              <div className="hidden text-right md:block">
                <div className="tabular text-sm font-semibold">{s.durationLabel}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Length
                </div>
              </div>
              <div className="hidden text-right md:block">
                <div className="tabular text-sm font-semibold">{fmtPlays(s.playcount)}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Plays
                </div>
              </div>
              <div className="text-right">
                <div className="tabular text-sm font-semibold text-primary">
                  {s.chartRank ? `#${s.chartRank}` : "—"}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Chart
                </div>
              </div>
            </div>
          ))}
        </div>
        {data.songs.length === 0 && (
          <p className="mt-8 text-muted-foreground">
            No top songs found for “{name}”. Try another spelling.
          </p>
        )}
        <section className="mt-12 rounded-xl border border-dashed p-6">
          <h2 className="text-2xl font-bold">Artist chart history</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Historical artist rankings will appear as SONGBOARD chart snapshots accumulate.
          </p>
        </section>
        <section className="mt-6 rounded-xl border border-dashed p-6">
          <h2 className="text-2xl font-bold">Related artists</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Artist recommendations are not generated yet.
          </p>
        </section>
        <p className="mt-8">
          <Link to="/artists" className="text-sm text-primary">
            ← Back to artists
          </Link>
        </p>
      </div>
    </main>
  );
}

function SongCover({ src, title, hue }: { src: string; title: string; hue: number }) {
  const [err, setErr] = useState(false);
  if (err) return <Cover hue={hue} title={title} size={52} />;
  return (
    <img
      src={src}
      alt={`${title} cover`}
      width={52}
      height={52}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setErr(true)}
      className="h-[52px] w-[52px] shrink-0 rounded-md object-cover"
    />
  );
}

function Missing() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 text-center md:px-6">
      <h1 className="text-4xl font-extrabold">Artist not found</h1>
      <p className="mt-3 text-muted-foreground">
        Last.fm returned no top songs for this name. Check the spelling or try another artist.
      </p>
      <div className="mx-auto mt-6 max-w-md">
        <ArtistSearch />
      </div>
      <p className="mt-6">
        <Link to="/artists" className="text-sm text-primary">
          ← Back to artists
        </Link>
      </p>
    </main>
  );
}
