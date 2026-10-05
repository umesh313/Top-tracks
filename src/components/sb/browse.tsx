import { memo } from "react";
import { Link } from "@tanstack/react-router";
import type { GenreTrack } from "@/lib/artists.functions";
import { fmtPlays, slugify } from "@/lib/artists.functions";
import { Cover } from "@/components/sb/bits";

function fmtDurationLabel(sec: number | null): string {
  if (!sec || sec <= 0) return "—";
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
}

/** One trending track row for genre/country pages. */
export const BrowseTrackRow = memo(function BrowseTrackRow({ t, offset }: { t: GenreTrack; offset: number }) {
  const artistSlug = slugify(t.artist);
  return (
    <div className="flex items-center gap-4 border-b py-3 last:border-b-0">
      <span className="w-8 shrink-0 text-right font-mono text-sm tabular text-muted-foreground">{offset + t.rank}</span>
      <Cover src={t.cover} resolve={{ artist: t.artist, track: t.title }} hue={t.rank * 37} title={t.title} />
      <div className="min-w-0 flex-1">
        <Link to="/artist/$slug" params={{ slug: artistSlug }} className="block truncate font-semibold hover:text-primary" preload="intent">
          {t.title}
        </Link>
        <Link to="/artist/$slug" params={{ slug: artistSlug }} className="block truncate text-sm text-muted-foreground hover:text-primary">
          {t.artist}
        </Link>
      </div>
      <div className="hidden shrink-0 text-right text-sm text-muted-foreground sm:block">
        <div className="tabular">{fmtPlays(t.playcount)} plays</div>
        <div className="tabular text-xs">{fmtPlays(t.listeners)} listeners</div>
      </div>
      <span className="w-14 shrink-0 text-right text-sm tabular text-muted-foreground">{fmtDurationLabel(null)}</span>
    </div>
  );
});

/** Prev/Next + numbered page links preserving the current search param. */
export function Pager({
  page, totalPages, makeSearch,
}: {
  page: number;
  totalPages: number;
  makeSearch: (p: number) => Record<string, unknown>;
}) {
  if (totalPages <= 1) return null;
  const pages = [...new Set([1, 2, page - 1, page, page + 1, totalPages - 1, totalPages].filter((p) => p >= 1 && p <= totalPages))];
  const btn = "inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-3 text-sm tabular transition hover:border-primary";
  return (
    <nav className="mt-8 flex flex-wrap items-center justify-center gap-2" aria-label="Pagination">
      {page > 1 ? (
        <Link to="." search={makeSearch(page - 1)} className={btn} rel="prev">← Prev</Link>
      ) : (
        <span className={`${btn} cursor-default opacity-40`}>← Prev</span>
      )}
      {pages.map((p, i) => (
        <span key={p} className="contents">
          {i > 0 && pages[i - 1] !== undefined && p - pages[i - 1]! > 1 && <span className="px-1 text-muted-foreground">…</span>}
          <Link to="." search={makeSearch(p)} className={`${btn} ${p === page ? "border-primary text-primary" : ""}`} aria-current={p === page ? "page" : undefined}>
            {p}
          </Link>
        </span>
      ))}
      {page < totalPages ? (
        <Link to="." search={makeSearch(page + 1)} className={btn} rel="next">Next →</Link>
      ) : (
        <span className={`${btn} cursor-default opacity-40`}>Next →</span>
      )}
    </nav>
  );
}