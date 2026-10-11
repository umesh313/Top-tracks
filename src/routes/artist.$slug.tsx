import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";
import { getArtist } from "@/lib/charts.functions";
import { Cover, LiveBadge, ShareButton, StatCard } from "@/components/sb/bits";
import { FollowButton } from "@/components/sb/vote";
const opts = (slug: string) =>
  queryOptions({
    queryKey: ["artist", slug],
    queryFn: () => getArtist({ data: { slug } }),
    placeholderData: keepPreviousData,
  });
export const Route = createFileRoute("/artist/$slug")({
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(opts(params.slug)).catch(() => null);
  },
  head: ({ params }) => {
    const n = "Artist";
    const description = `Explore ${n}'s songs, current chart presence and chart history on SONGBOARD.`;
    return {
      meta: [
        { title: `${n} — Artist Chart | SONGBOARD` },
        { name: "description", content: description },
        { property: "og:title", content: `${n} — SONGBOARD` },
        { property: "og:description", content: description },
        { property: "og:type", content: "profile" },
        { name: "twitter:title", content: `${n} — Artist Chart | SONGBOARD` },
        { name: "twitter:description", content: description },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: `/artist/${encodeURIComponent(params.slug)}` }],
    };
  },
  component: Page,
  notFoundComponent: () => (
    <main className="p-12">
      <h1>Artist not found</h1>
    </main>
  ),
});
function Page() {
  const { slug } = Route.useParams();
  const { data, isPending } = useQuery(opts(slug));
  if (isPending && !data) return null;
  if (!data || !data.artist) throw notFound();
  const latest = new Map<string, (typeof data.entries)[number]>();
  for (const e of data.entries) latest.set(e.song_id, e);
  const ranked = [...data.songs].sort(
    (a, b) => (latest.get(a.id)?.rank ?? 999) - (latest.get(b.id)?.rank ?? 999),
  );
  return (
    <main>
      <section className="relative overflow-hidden border-b">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background: `radial-gradient(circle at 20% 30%,oklch(.6 .18 ${data.artist.hue}),transparent 45%)`,
          }}
        />
        <div className="relative mx-auto flex max-w-7xl flex-col gap-8 px-4 py-16 md:flex-row md:items-end md:px-6">
          <Cover
            src={data.artist.image}
            hue={data.artist.hue}
            title={data.artist.name}
            size={220}
            className="rounded-full"
          />
          <div>
            <LiveBadge />
            <h1 className="mt-4 text-5xl font-extrabold md:text-7xl">{data.artist.name}</h1>
            <div className="mt-3 flex gap-3 text-muted-foreground">
              <span>
                {data.artist.country?.flag} {data.artist.country?.name}
              </span>
              <span>·</span>
              <span>{data.artist.genre?.name}</span>
            </div>
            <p className="mt-4 max-w-xl text-muted-foreground">{data.artist.bio}</p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <FollowButton type="artist" id={data.artist.id} />
              <ShareButton title={`${data.artist.name} on SONGBOARD`} />
            </div>
          </div>
        </div>
      </section>
      <div className="mx-auto max-w-7xl px-4 py-14 md:px-6">
        <section
          className="mb-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
          aria-label="Artist overview"
        >
          <StatCard
            label="Monthly listeners"
            value={Number(data.artist.monthly_listeners).toLocaleString()}
          />
          <StatCard label="Songs in catalog" value={data.songs.length} />
          <StatCard
            label="Songs currently charting"
            value={ranked.filter((song) => latest.has(song.id)).length}
            tone="people"
          />
          <StatCard
            label="Best current rank"
            value={
              ranked.some((song) => latest.has(song.id))
                ? `#${Math.min(...ranked.filter((song) => latest.has(song.id)).map((song) => latest.get(song.id)!.rank))}`
                : "—"
            }
            tone="momentum"
          />
          <StatCard
            label="Artist momentum"
            value="—"
            detail="Artist-level trend not available yet."
            tone="momentum"
          />
        </section>
        <h2 className="mb-6 text-3xl font-bold">Artist Top 10</h2>
        <div>
          {ranked.slice(0, 10).map((s, i) => {
            const e = latest.get(s.id);
            return (
              <Link
                to="/song/$slug"
                params={{ slug: s.slug }}
                key={s.id}
                className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 border-b py-3 hover:bg-accent/30"
              >
                <span className="tabular text-xl font-bold">{i + 1}</span>
                <div className="flex items-center gap-3">
                  <Cover
                    src={s.image}
                    resolve={{ artist: data.artist.name, track: s.title }}
                    hue={s.hue}
                    title={s.title}
                    size={48}
                  />
                  <div>
                    <div className="font-semibold">{s.title}</div>
                    <div className="text-sm text-muted-foreground">{s.album?.title}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="tabular font-bold">{e ? `#${e.rank}` : "—"}</div>
                  <div className="text-[10px] uppercase text-muted-foreground">Global</div>
                </div>
              </Link>
            );
          })}
        </div>
        <section className="mt-14 rounded-xl border border-dashed p-6">
          <h2 className="text-2xl font-bold">Artist chart history</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Historical artist rankings will appear as chart snapshots become available.
          </p>
        </section>
        <section className="mt-8 rounded-xl border border-dashed p-6">
          <h2 className="text-2xl font-bold">Related artists</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Related artist discovery is a future extension; no recommendations are generated yet.
          </p>
        </section>
        <h2 className="mb-6 mt-16 text-3xl font-bold">Discography</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
          {data.songs.map((s) => (
            <Link to="/song/$slug" params={{ slug: s.slug }} key={s.id}>
              <Cover
                src={s.image}
                resolve={{ artist: data.artist.name, track: s.title }}
                hue={s.hue}
                title={s.title}
                size={180}
                className="!h-auto w-full aspect-square"
              />
              <div className="mt-2 truncate font-semibold">{s.title}</div>
              <div className="text-xs text-muted-foreground">{s.release_date}</div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
