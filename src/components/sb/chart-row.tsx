import { memo } from "react";
import { Link } from "@tanstack/react-router";
import type { ChartRow as Row } from "@/lib/charts.functions";
import { Cover, Move } from "./bits";
import { VoteButtons } from "./vote";

export const ChartRow = memo(function ChartRow({ r, showScores = true, rankOverride }: { r: Row; showScores?: boolean; rankOverride?: number }) {
  return (
    <div className="anim-row group grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 border-b border-border/60 py-3 md:grid-cols-[3.5rem_1fr_repeat(3,4.5rem)_auto] md:gap-4" style={{ contentVisibility: "auto", containIntrinsicSize: "76px" }}>
      <div className="text-center">
        <div className="font-display text-2xl font-extrabold leading-none tabular md:text-3xl">{rankOverride ?? r.rank}</div>
        <Move rank={r.rank} prev={r.prev_rank} woc={r.weeks_on_chart} className="mt-1" />
      </div>
      <Link to="/song/$slug" params={{ slug: r.song.slug }} className="flex min-w-0 items-center gap-3" preload="intent">
        <Cover src={r.song.image} resolve={{ artist: r.song.artist.name, track: r.song.title }} hue={r.song.hue} title={r.song.title} size={52} className="transition-transform duration-150 group-hover:scale-105" />
        <div className="min-w-0">
          <div className="truncate font-semibold group-hover:text-primary">{r.song.title}</div>
          <div className="truncate text-sm text-muted-foreground">{r.song.artist.name}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground/80 tabular">Peak #{r.peak_rank} · {r.weeks_on_chart} wks</div>
        </div>
      </Link>
      {showScores && (
        <>
          <Stat label="Chart" v={r.chart_score} cls="text-foreground" />
          <Stat label="People" v={r.people_score} cls="text-people" />
          <Stat label="Momentum" v={r.momentum_score} cls="text-momentum" />
        </>
      )}
      <VoteButtons songId={r.song.id} compact />
    </div>
  );
});

function Stat({ label, v, cls }: { label: string; v: number; cls: string }) {
  return (
    <div className="hidden text-right md:block">
      <div className={`tabular text-sm font-semibold ${cls}`}>{Number(v).toFixed(0)}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
