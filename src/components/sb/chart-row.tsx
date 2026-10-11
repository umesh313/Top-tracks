import { memo } from "react";
import { Link } from "@tanstack/react-router";
import type { ChartRow as Row } from "@/lib/charts.functions";
import { Cover, Move, ShareButton } from "./bits";
import { VoteButtons } from "./vote";

type ChartRowProps = { r: Row; showScores?: boolean; rankOverride?: number };

export const ChartRow = memo(function ChartRow({
  r,
  showScores = true,
  rankOverride,
}: ChartRowProps) {
  return (
    <div
      className="anim-row group grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-border/60 py-3 md:grid-cols-[3.5rem_minmax(0,1fr)_repeat(4,4rem)_auto] md:gap-4"
      style={{ contentVisibility: "auto", containIntrinsicSize: "76px" }}
    >
      <div className="text-center">
        <div className="font-display text-2xl font-extrabold leading-none tabular md:text-3xl">
          {rankOverride ?? r.rank}
        </div>
        <Move rank={r.rank} prev={r.prev_rank} woc={r.weeks_on_chart} className="mt-1" />
      </div>
      <Link
        to="/song/$slug"
        params={{ slug: r.song.slug }}
        className="flex min-w-0 items-center gap-3"
        preload="intent"
      >
        <Cover
          src={r.song.image}
          resolve={{ artist: r.song.artist.name, track: r.song.title }}
          hue={r.song.hue}
          title={r.song.title}
          size={52}
          className="transition-transform duration-150 group-hover:scale-105"
        />
        <div className="min-w-0">
          <div className="truncate font-semibold group-hover:text-primary">{r.song.title}</div>
          <div className="truncate text-sm text-muted-foreground">{r.song.artist.name}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground/80 tabular">
            Peak #{r.peak_rank} · {r.weeks_on_chart} wks
          </div>
        </div>
      </Link>
      {showScores && (
        <>
          <Stat label="Total" v={r.songboard_score} cls="text-primary" />
          <Stat label="Chart" v={r.chart_score} cls="text-foreground" />
          <Stat label="People" v={r.people_score} cls="text-people" />
          <Stat label="Momentum" v={r.momentum_score} cls="text-momentum" />
        </>
      )}
      <div className="flex items-center gap-1">
        <VoteButtons songId={r.song.id} compact />
        <ShareButton
          title={`${r.song.title} by ${r.song.artist.name}`}
          url={`/song/${encodeURIComponent(r.song.slug)}`}
          compact
        />
      </div>
    </div>
  );
});

/** Full chart-row presentation used wherever a reusable track card is needed. */
export function TrackCard(props: ChartRowProps) {
  return <ChartRow {...props} />;
}

/** Ranked artist row for the Top Artists charts (daily + weekly). */
export function ArtistRow({
  rank,
  name,
  image,
  hue,
  stat1,
  stat1Label,
  stat2,
  stat2Label,
  detail,
}: {
  rank: number;
  name: string;
  image: string | null;
  hue: number;
  stat1: string;
  stat1Label: string;
  stat2?: string | null;
  stat2Label?: string;
  detail?: string | null;
}) {
  return (
    <div
      className="anim-row group grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-border/60 py-3 md:grid-cols-[3.5rem_minmax(0,1fr)_repeat(2,7rem)] md:gap-4"
      style={{ contentVisibility: "auto", containIntrinsicSize: "76px" }}
    >
      <div className="text-center font-display text-2xl font-extrabold leading-none tabular md:text-3xl">
        {rank}
      </div>
      <Link
        to="/artists/$name"
        params={{ name }}
        className="flex min-w-0 items-center gap-3"
        preload="intent"
      >
        <Cover
          src={image}
          hue={hue}
          title={name}
          size={52}
          className="rounded-full transition-transform duration-150 group-hover:scale-105"
        />
        <div className="min-w-0">
          <div className="truncate font-semibold group-hover:text-primary">{name}</div>
          {detail && (
            <div className="mt-0.5 truncate text-[11px] text-muted-foreground/80 tabular">
              {detail}
            </div>
          )}
        </div>
      </Link>
      <div className="hidden text-right md:block">
        <div className="tabular text-sm font-semibold">{stat1}</div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {stat1Label}
        </div>
      </div>
      <div className="text-right">
        <div className="tabular text-sm font-semibold md:hidden">{stat1}</div>
        {stat2 != null && (
          <>
            <div className="hidden tabular text-sm font-semibold md:block">{stat2}</div>
            {stat2Label && (
              <div className="hidden text-[10px] uppercase tracking-wider text-muted-foreground md:block">
                {stat2Label}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, v, cls }: { label: string; v: number; cls: string }) {
  return (
    <div className="hidden text-right md:block">
      <div className={`tabular text-sm font-semibold ${cls}`}>{Number(v).toFixed(0)}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
