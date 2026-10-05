import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { fmtPlays, getArtistTopSongs, searchArtists, type ArtistHit } from "@/lib/artists.functions";
import { Cover } from "./bits";

function useDebounced(value: string, ms = 300): string {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function ArtistAvatar({ a, size = 44 }: { a: ArtistHit; size?: number }) {
  const [err, setErr] = useState(false);
  if (a.image && !err) return <img src={a.image} alt={a.name} width={size} height={size} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setErr(true)} className="rounded-full object-cover" style={{ width: size, height: size }} />;
  return <Cover hue={a.hue} title={a.name} size={size} className="rounded-full" />;
}

export function ArtistCard({ a }: { a: ArtistHit }) {
  return (
    <Link to="/artists/$name" params={{ name: a.name }} className="group flex items-center gap-4 rounded-xl border p-4 transition hover:-translate-y-0.5 hover:border-primary">
      <ArtistAvatar a={a} size={64} />
      <div className="min-w-0">
        <div className="truncate text-lg font-bold group-hover:text-primary">{a.name}</div>
        <div className="text-sm text-muted-foreground tabular">{fmtPlays(a.listeners)} listeners</div>
      </div>
    </Link>
  );
}

export function ArtistRow({ a, onPick }: { a: ArtistHit; onPick?: () => void }) {
  const [focused, setFocused] = useState(false);
  const topFn = useServerFn(getArtistTopSongs);
  const top = useQuery({
    queryKey: ["artist-top-1", a.name],
    queryFn: () => topFn({ data: { name: a.name, limit: 1 } }),
    staleTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
    enabled: focused,
  });
  const topSong = top.data?.songs[0];
  return (
    <Link to="/artists/$name" params={{ name: a.name }} onClick={onPick} onMouseEnter={() => setFocused(true)} onFocus={() => setFocused(true)} className="anim-row flex items-center gap-3 border-b border-border/50 p-3 last:border-0 hover:bg-accent">
      <ArtistAvatar a={a} size={44} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{a.name}</div>
        <div className="truncate text-xs text-muted-foreground tabular">
          {fmtPlays(a.listeners)} listeners{topSong ? ` · Top: “${topSong.title}”${topSong.durationLabel !== "—" ? ` (${topSong.durationLabel})` : ""}` : top.isPending ? " · loading top song…" : ""}
        </div>
      </div>
      <span className="shrink-0 text-xs font-semibold text-primary">Songs →</span>
    </Link>
  );
}

export function ArtistSearch({ autoFocus = false }: { autoFocus?: boolean }) {
  const [q, setQ] = useState("");
  const debounced = useDebounced(q, 300);
  const fn = useServerFn(searchArtists);
  const res = useQuery({
    queryKey: ["artist-search", debounced],
    queryFn: () => fn({ data: { q: debounced } }),
    enabled: debounced.trim().length >= 2,
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
  });
  const boxRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(true);
  const navigate = useNavigate();
  const go = (nm: string) => {
    const n = nm.trim();
    if (!n) return;
    setOpen(false);
    navigate({ to: "/artists/$name", params: { name: n } });
  };
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  const showDropdown = open && debounced.trim().length >= 2;
  return (
    <div ref={boxRef} className="relative">
      <form onSubmit={(e) => { e.preventDefault(); go(res.data?.artists[0]?.name ?? debounced); }}>
      <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
      <input
        value={q} autoFocus={autoFocus}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Search any artist… (Enter to open)"
        aria-label="Search artists"
        className="h-14 w-full rounded-lg border bg-card pl-12 pr-4 text-lg outline-none focus:border-primary"
      />
      </form>
      {showDropdown && (
        <div className="absolute z-20 mt-2 max-h-96 w-full overflow-auto rounded-lg border bg-card shadow-xl">
          {res.isPending && <div className="space-y-2 p-3">{[0, 1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-md bg-muted" />)}</div>}
          {res.isError && (
            <div className="p-4 text-sm">
              <p className="text-destructive">{res.error instanceof Error ? res.error.message : "Search failed."}</p>
              <button onClick={() => res.refetch()} className="mt-2 rounded-md border px-3 py-1 text-sm hover:border-primary">Retry</button>
            </div>
          )}
          {res.data && res.data.artists.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground">No artists found for “{debounced}”.</div>
          )}
          {res.data?.artists.map((a) => (
            <ArtistRow key={a.slug + a.name} a={a} onPick={() => setOpen(false)} />
          ))}
        </div>
      )}
    </div>
  );
}
