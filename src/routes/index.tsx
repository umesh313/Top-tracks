import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, Flame, Radio, TrendingUp, Users } from "lucide-react";
import { getChart } from "@/lib/charts.functions";
import type { ChartRow as ChartRowData } from "@/lib/charts.functions";
import { ChartRow } from "@/components/sb/chart-row";
import { Cover, DemoBadge, Move, ScoreBar, SectionTitle } from "@/components/sb/bits";
import { VoteButtons } from "@/components/sb/vote";

const chartQuery = queryOptions({ queryKey: ["chart", "latest"], queryFn: () => getChart({ data: {} }), staleTime: 5 * 60 * 1000 });
export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(chartQuery).catch(() => null),
  pendingComponent: HomeSkeleton,
  head: () => ({ meta: [
    { title: "SONGBOARD — Where the Numbers Meet the People" },
    { name: "description", content: "The music chart combining streaming, radio, social momentum and public votes." },
    { property: "og:title", content: "SONGBOARD — Where the Numbers Meet the People" },
    { property: "og:description", content: "See today's most influential songs and cast your vote." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ]}), component: Home,
});
function Home() {
  const { data } = useSuspenseQuery(chartQuery);
  if (!data) return <HomeSkeleton />;
  const top = data.rows[0];
  if (!top) return <main className="mx-auto max-w-7xl p-8">Chart data unavailable.</main>;
  const movers = [...data.rows].sort((a,b) => b.momentum_score-a.momentum_score).slice(0,5);
  const trending = [...data.rows].sort((a,b) => b.momentum_score-a.momentum_score).slice(0,6);
  const people = [...data.rows].sort((a,b) => b.people_score-a.people_score).slice(0,5);
  return <main>
    <section className="relative overflow-hidden border-b">
      <div className="absolute inset-0 opacity-40" style={{ background: `radial-gradient(circle at 70% 20%, oklch(0.55 0.18 ${top.song.hue}) 0%, transparent 48%)` }} />
      <div className="relative mx-auto grid min-h-[76vh] max-w-7xl items-center gap-10 px-4 py-16 md:grid-cols-[1.1fr_.9fr] md:px-6">
        <div className="anim-rise z-10">
          <div className="mb-7 flex items-center gap-3"><DemoBadge /><span className="text-xs uppercase tracking-[.2em] text-muted-foreground">Week of {new Date(data.week!.week_start+"T00:00:00Z").toLocaleDateString("en", { month:"short", day:"numeric", year:"numeric", timeZone:"UTC" })}</span></div>
          <div className="mb-3 flex items-center gap-3"><span className="font-display text-6xl font-extrabold text-primary tabular">#1</span><Move rank={top.rank} prev={top.prev_rank} woc={top.weeks_on_chart}/></div>
          <h1 className="max-w-3xl text-5xl font-extrabold leading-[.95] md:text-7xl">{top.song.title}</h1>
          <Link to="/artists/$name" params={{ name: top.song.artist.name }} className="mt-3 inline-block text-xl text-muted-foreground hover:text-primary">{top.song.artist.name}</Link>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">The world's most dynamic music chart. Performance meets public opinion.</p>
          <div className="mt-8 flex flex-wrap items-center gap-3"><VoteButtons songId={top.song.id}/><Link to="/song/$slug" params={{ slug: top.song.slug }} className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-bold text-background">Full breakdown <ArrowRight className="h-4 w-4"/></Link></div>
        </div>
        <div className="anim-pop relative mx-auto w-full max-w-md" style={{ animationDelay: "80ms" }}>
          <Cover hue={top.song.hue} title={top.song.title} size={430} className="!h-auto w-full aspect-square shadow-2xl"/>
          <div className="mt-5 grid grid-cols-3 gap-3"><HeroScore icon={<Radio/>} label="Chart" value={top.chart_score}/><HeroScore icon={<Users/>} label="People" value={top.people_score}/><HeroScore icon={<Flame/>} label="Momentum" value={top.momentum_score}/></div>
        </div>
      </div>
    </section>
    <div className="mx-auto max-w-7xl px-4 py-16 md:px-6">
      <section><SectionTitle kicker="This week" title="Global Top 10"><Link to="/charts" className="inline-flex items-center gap-1 text-sm text-primary">View Top 100 <ArrowRight className="h-4 w-4"/></Link></SectionTitle><div>{data.rows.slice(0,10).map(r => <ChartRow key={r.song.id} r={r}/>)}</div></section>
      <section className="mt-20"><SectionTitle kicker="Accelerating" title="Trending now"><Flame className="text-primary"/></SectionTitle><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{trending.map(r=><MiniCard key={r.song.id} r={r}/>)}</div></section>
      <section className="mt-20 grid gap-12 lg:grid-cols-2"><div><SectionTitle kicker="Momentum" title="Biggest movers"/><div>{movers.map(r=><ChartRow key={r.song.id} r={r} showScores={false}/>)}</div><Link to="/movers" className="mt-5 inline-flex items-center gap-1 text-sm text-primary">All movers <ArrowRight className="h-4 w-4"/></Link></div><div><SectionTitle kicker="Your voice" title="People's Chart"/><div>{people.map((r,i)=><ChartRow key={r.song.id} r={r} rankOverride={i+1} showScores={false}/>)}</div><Link to="/people" className="mt-5 inline-flex items-center gap-1 text-sm text-primary">Full People's Chart <ArrowRight className="h-4 w-4"/></Link></div></section>
      <section className="mt-20"><SectionTitle kicker="Explore" title="Browse by genre"/><div className="grid grid-cols-2 gap-3 md:grid-cols-5">{data.genres.map(g=><Link key={g.id} to="/genres/$genre" params={{genre:g.id}} className="relative overflow-hidden rounded-lg border p-5 font-display text-lg font-bold transition hover:-translate-y-1 hover:border-primary" style={{background:`linear-gradient(135deg, oklch(0.25 0.06 ${g.hue}), transparent)`}}>{g.name}<div className="mt-8 text-xs font-sans font-normal text-muted-foreground">View chart →</div></Link>)}</div></section>
    </div>
  </main>;
}
function HeroScore({icon,label,value}:{icon:React.ReactNode;label:string;value:number}) { return <div className="rounded-lg border bg-card/80 p-3 backdrop-blur"><div className="mb-2 flex items-center gap-1 text-muted-foreground [&>svg]:h-3 [&>svg]:w-3">{icon}<span className="text-[10px] uppercase">{label}</span></div><div className="tabular text-xl font-bold">{Number(value).toFixed(0)}</div></div> }
function MiniCard({r}:{r:ChartRowData}) { return <Link to="/song/$slug" params={{slug:r.song.slug}} className="group flex items-center gap-4 rounded-lg border bg-card p-4 transition hover:border-primary"><Cover src={r.song.image} resolve={{ artist: r.song.artist.name, track: r.song.title }} hue={r.song.hue} title={r.song.title} size={64}/><div className="min-w-0 flex-1"><div className="truncate font-bold">{r.song.title}</div><div className="truncate text-sm text-muted-foreground">{r.song.artist.name}</div><div className="mt-2"><ScoreBar label="Momentum" value={r.momentum_score} tone="momentum"/></div></div><TrendingUp className="h-5 w-5 text-momentum"/></Link> }

function HomeSkeleton() {
  return (
    <main className="anim-rise">
      <section className="border-b">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 md:grid-cols-[1.1fr_.9fr] md:px-6">
          <div className="space-y-4"><div className="shimmer h-6 w-40 rounded" /><div className="shimmer h-16 w-3/4 rounded-lg" /><div className="shimmer h-6 w-1/2 rounded" /></div>
          <div className="shimmer mx-auto aspect-square w-full max-w-md rounded-xl" />
        </div>
      </section>
      <div className="mx-auto max-w-7xl space-y-3 px-4 py-16 md:px-6">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="shimmer h-16 rounded-md" />)}</div>
    </main>
  );
}
