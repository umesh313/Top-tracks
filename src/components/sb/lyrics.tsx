import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, ChevronDown, ListMusic, Music2 } from "lucide-react";
import { toast } from "sonner";
import { getLyrics } from "@/lib/lyrics.functions";
import { EmptyState, LoadingState } from "./bits";
import { cn } from "@/lib/utils";

function fmt(time: number): string {
  const m = Math.floor(time / 60);
  const s = Math.floor(time % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export const LYRICS_PREVIEW_LINES = 8;

export function LyricsSection({
  artist,
  track,
  album,
  duration,
}: {
  artist: string;
  track: string;
  album?: string | null;
  duration?: number | null;
}) {
  const [showTimes, setShowTimes] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const lyricsFn = useServerFn(getLyrics);
  const key = [artist, track, album ?? "", duration ?? 0];
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["lyrics", ...key],
    queryFn: () =>
      lyricsFn({
        data: {
          artist,
          track,
          ...(album ? { album } : {}),
          ...(duration ? { duration } : {}),
        },
      }),
    staleTime: 1000 * 60 * 60 * 24,
    retry: 1,
  });

  const copy = async () => {
    if (!data || data.status === "not_found" || data.status === "instrumental") return;
    try {
      await navigator.clipboard.writeText(data.lines.map((l) => l.text).join("\n"));
      toast.success("Lyrics copied.");
    } catch {
      toast.error("Couldn't copy lyrics.");
    }
  };

  return (
    <section className="mt-16">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[.2em] text-primary">
            <ListMusic className="h-4 w-4" /> Lyrics
          </div>
          <h2 className="text-3xl font-bold">Lyrics</h2>
        </div>
        {data && (data.status === "synced" || data.status === "plain") && (
          <div className="flex items-center gap-2">
            {data.status === "synced" && (
              <button
                type="button"
                onClick={() => setShowTimes((v) => !v)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs",
                  showTimes && "border-primary text-primary",
                )}
              >
                Timestamps
              </button>
            )}
            <button
              type="button"
              onClick={() => void copy()}
              className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs hover:border-primary hover:text-primary"
            >
              <Copy className="h-3 w-3" /> Copy
            </button>
          </div>
        )}
      </div>
      <div className="rounded-lg border bg-card p-6">
        {isPending ? <LoadingState label="Looking up lyrics…" /> : null}
        {isError ? (
          <div role="alert">
            <p className="text-sm text-destructive">Lyrics couldn't load right now.</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="mt-3 rounded-md border px-3 py-1.5 text-sm hover:border-primary"
            >
              Try again
            </button>
          </div>
        ) : null}
        {data?.status === "not_found" ? (
          <EmptyState
            title="No lyrics found"
            description={`We couldn't find lyrics for “${track}” by ${artist} yet.`}
          />
        ) : null}
        {data?.status === "instrumental" ? (
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Music2 className="h-5 w-5" />
            <p>
              This track is marked as <strong className="text-foreground">instrumental</strong> — no
              lyrics to show.
            </p>
          </div>
        ) : null}
        {(data?.status === "synced" || data?.status === "plain") && (
          <div>
            {data.status === "synced" && (
              <p className="mb-4 inline-block rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                Synced · line timestamps from LRCLIB
              </p>
            )}
            <div className="relative">
              <div
                className={cn(
                  !expanded &&
                    data.lines.length > LYRICS_PREVIEW_LINES &&
                    "max-h-56 overflow-hidden",
                  expanded && data.lines.length > 40 && "max-h-[480px] overflow-y-auto pr-2",
                )}
              >
                {data.lines.slice(0, expanded ? undefined : LYRICS_PREVIEW_LINES).map((l, i) => (
                  <p key={i} className="flex gap-3 text-[15px] leading-7">
                    {showTimes && l.time != null && (
                      <span className="w-12 shrink-0 select-none tabular text-muted-foreground">
                        {fmt(l.time)}
                      </span>
                    )}
                    <span>{l.text}</span>
                  </p>
                ))}
              </div>
              {!expanded && data.lines.length > LYRICS_PREVIEW_LINES && (
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-card to-transparent"
                  aria-hidden
                />
              )}
            </div>
            {data.lines.length > LYRICS_PREVIEW_LINES && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
                className="mt-4 inline-flex items-center gap-1 rounded-full border px-4 py-1.5 text-sm font-medium transition hover:border-primary hover:text-primary"
              >
                {expanded ? "Show less" : `Show full lyrics (${data.lines.length} lines)`}
                <ChevronDown
                  className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")}
                />
              </button>
            )}
            <p className="mt-5 border-t pt-3 text-xs text-muted-foreground">
              Lyrics by {data.artistName} · “{data.trackName}” — provided by{" "}
              <a
                href="https://lrclib.net"
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-primary"
              >
                LRCLIB
              </a>
              .
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
