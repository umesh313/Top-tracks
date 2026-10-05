import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Minus, Sparkles, RotateCcw } from "lucide-react";
import { movement } from "@/lib/chart-engine";
import { requestCover } from "@/lib/cover-client";
import { cn } from "@/lib/utils";

/**
 * Album/artist artwork: real image when `src` resolves, otherwise a unique
 * gradient placeholder (per-song hue). Falls back to the gradient on load error.
 *
 * Pass `resolve={{ artist, track }}` to fill in artwork client-side (iTunes)
 * when the server has no image — loading starts as the tile scrolls into view.
 */
export function Cover({ hue, title, size = 48, className, src, resolve }: {
  hue: number;
  title: string;
  size?: number;
  className?: string;
  src?: string | null;
  resolve?: { artist: string; track: string } | null;
}) {
  const [err, setErr] = useState(false);
  const [live, setLive] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);
  const rArtist = resolve?.artist ?? null;
  const rTrack = resolve?.track ?? null;
  const h2 = (hue + 50) % 360;

  useEffect(() => {
    if (src || !rArtist || !rTrack) return;
    let cancelled = false;
    const start = () => {
      void requestCover(rArtist, rTrack).then((u) => {
        if (!cancelled && u) setLive(u);
      });
    };
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      start();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          start();
        }
      },
      { rootMargin: "240px" },
    );
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
    };
  }, [src, rArtist, rTrack]);

  const finalSrc = src ?? live;
  if (finalSrc && !err)
    return (
      <img
        src={finalSrc}
        alt={`${title} cover`}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setErr(true)}
        className={cn("shrink-0 rounded-md object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  return (
    <div
      ref={ref}
      className={cn("relative shrink-0 overflow-hidden rounded-md grain", className)}
      style={{ width: size, height: size, background: `radial-gradient(circle at 30% 25%, oklch(0.78 0.16 ${hue}) 0%, oklch(0.45 0.18 ${h2}) 55%, oklch(0.18 0.05 ${h2}) 100%)` }}
      aria-hidden
    >
      <span className="absolute bottom-1 left-1.5 font-display font-extrabold leading-none text-foreground/90" style={{ fontSize: Math.max(10, size / 3.2) }}>
        {title.slice(0, 1)}
      </span>
    </div>
  );
}

export function Move({ rank, prev, woc, className }: { rank: number; prev: number | null; woc: number; className?: string }) {
  const m = movement(rank, prev, woc);
  const base = "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-bold tabular";
  if (m.kind === "new") return <span className={cn(base, "bg-primary text-primary-foreground", className)}><Sparkles className="h-3 w-3" />NEW</span>;
  if (m.kind === "re") return <span className={cn(base, "bg-momentum/20 text-momentum", className)}><RotateCcw className="h-3 w-3" />RE</span>;
  if (m.kind === "up") return <span className={cn(base, "text-up", className)}><ArrowUp className="h-3 w-3" />{m.delta}</span>;
  if (m.kind === "down") return <span className={cn(base, "text-down", className)}><ArrowDown className="h-3 w-3" />{m.delta}</span>;
  return <span className={cn(base, "text-muted-foreground", className)}><Minus className="h-3 w-3" /></span>;
}

export function ScoreBar({ label, value, tone = "primary" }: { label: string; value: number; tone?: "primary" | "people" | "momentum" | "muted" }) {
  const c = { primary: "bg-primary", people: "bg-people", momentum: "bg-momentum", muted: "bg-foreground/60" }[tone];
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs"><span className="text-muted-foreground">{label}</span><span className="tabular">{Number(value).toFixed(1)}</span></div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full transition-all duration-700", c)} style={{ width: `${Math.min(100, Number(value))}%` }} /></div>
    </div>
  );
}

export function LiveBadge() {
  return <span className="rounded-full border border-dashed border-foreground/25 px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">Live Last.fm data</span>;
}

/** @deprecated Use LiveBadge. */
export const DemoBadge = LiveBadge;

export function SectionTitle({ kicker, title, children }: { kicker?: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        {kicker && <div className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">{kicker}</div>}
        <h2 className="text-2xl font-bold md:text-3xl">{title}</h2>
      </div>
      {children}
    </div>
  );
}
