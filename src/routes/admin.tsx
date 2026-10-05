import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Database, RefreshCw, Search, Settings2, Shield } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMyState } from "@/hooks/use-auth";
import { getWeights } from "@/lib/charts.functions";
import { importMusicBrainzRecordings, searchMusicBrainz } from "@/lib/musicbrainz.functions";
import { resetCatalogFromLastFm } from "@/lib/lastfm.functions";
import { generateChart, updateWeights } from "@/lib/user.functions";

type MusicBrainzResult = {
  id: string;
  title: string;
  artist: string;
  artistId: string | null;
  album: string | null;
  releaseDate: string | null;
  durationSec: number | null;
  isrc: string | null;
};

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Chart Administration — SONGBOARD" },
      { name: "description", content: "Manage SONGBOARD chart weights, catalog imports, and weekly generation." },
      { property: "og:title", content: "SONGBOARD Administration" },
      { property: "og:description", content: "Chart and catalog management console." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

function Page() {
  const { session, me } = useMyState();
  const get = useServerFn(getWeights);
  const save = useServerFn(updateWeights);
  const generate = useServerFn(generateChart);
  const searchCatalog = useServerFn(searchMusicBrainz);
  const importRecordings = useServerFn(importMusicBrainzRecordings);
  const resyncLastfm = useServerFn(resetCatalogFromLastFm);
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["weights"], queryFn: () => get() });
  const [generating, setGenerating] = useState(false);
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [resyncing, setResyncing] = useState(false);
  const [results, setResults] = useState<MusicBrainzResult[]>([]);
  const [selected, setSelected] = useState<string[]>([]);

  if (!session) return <Denied text="Sign in with an administrator account." />;
  if (me && !me.isAdmin) return <Denied text="You do not have administrator access." />;

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 md:px-6">
      <div className="flex items-center gap-3">
        <Shield className="h-9 w-9 text-primary" />
        <div>
          <div className="text-xs uppercase tracking-[.2em] text-primary">Administration</div>
          <h1 className="text-5xl font-extrabold">Chart control</h1>
        </div>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-2">
        <section className="rounded-lg border bg-card p-6">
          <h2 className="flex items-center gap-2 text-xl font-bold"><Settings2 /> Scoring weights</h2>
          <p className="mt-2 text-sm text-muted-foreground">All five values must total 100%.</p>
          {data && (
            <form
              className="mt-6 space-y-4"
              onSubmit={async (event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                const values = {
                  streaming: Number(form.get("streaming")),
                  radio: Number(form.get("radio")),
                  people: Number(form.get("people")),
                  social: Number(form.get("social")),
                  search: Number(form.get("search")),
                };
                if (Object.values(values).reduce((sum, value) => sum + value, 0) !== 100) {
                  toast.error("Weights must total 100%");
                  return;
                }
                await save({ data: values });
                toast.success("Weights updated");
                void queryClient.invalidateQueries({ queryKey: ["weights"] });
              }}
            >
              {Object.entries(data)
                .filter(([key]) => ["streaming", "radio", "people", "social", "search"].includes(key))
                .map(([key, value]) => (
                  <div key={key} className="grid grid-cols-[1fr_6rem] items-center gap-3">
                    <Label htmlFor={key} className="capitalize">{key}</Label>
                    <div className="relative">
                      <Input id={key} name={key} type="number" min="0" max="100" defaultValue={Number(value)} className="pr-7" />
                      <span className="absolute right-2 top-2 text-muted-foreground">%</span>
                    </div>
                  </div>
                ))}
              <Button className="w-full">Save weights</Button>
            </form>
          )}
        </section>

        <section className="rounded-lg border bg-card p-6">
          <h2 className="flex items-center gap-2 text-xl font-bold"><RefreshCw /> Weekly chart</h2>
          <p className="mt-2 text-sm text-muted-foreground">Generate the next chart from provider metrics and verified public votes.</p>
          <Button
            disabled={generating}
            className="mt-6"
            onClick={async () => {
              setGenerating(true);
              try {
                const result = await generate();
                toast.success(`Generated ${result.weekStart} with ${result.entries} entries`);
                void queryClient.invalidateQueries();
              } catch {
                toast.error("Chart generation failed");
              } finally {
                setGenerating(false);
              }
            }}
          >
            {generating ? "Generating…" : "Generate next chart"}
          </Button>
        </section>
      </div>

      <section className="mt-6 border-t pt-8">
        <div className="max-w-3xl">
          <h2 className="flex items-center gap-2 text-xl font-bold"><Database /> MusicBrainz catalog</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Search real recordings, select the correct versions, then import their artist and release metadata. Chart numbers now come from live Last.fm data.
          </p>
          <form
            className="mt-5 flex gap-2"
            onSubmit={async (event) => {
              event.preventDefault();
              const query = String(new FormData(event.currentTarget).get("catalog-query") ?? "").trim();
              if (query.length < 2) return;
              setSearching(true);
              setSelected([]);
              try {
                const found = await searchCatalog({ data: { query } });
                setResults(found);
                if (!found.length) toast.info("No MusicBrainz recordings found");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "MusicBrainz search failed");
              } finally {
                setSearching(false);
              }
            }}
          >
            <Input name="catalog-query" aria-label="Search MusicBrainz" placeholder="Song title or artist" minLength={2} required />
            <Button type="submit" disabled={searching} aria-label="Search MusicBrainz">
              <Search /> {searching ? "Searching…" : "Search"}
            </Button>
          </form>
        </div>

        {results.length > 0 && (
          <div className="mt-6 overflow-hidden rounded-lg border">
            <div className="divide-y">
              {results.map((result) => {
                const isSelected = selected.includes(result.id);
                return (
                  <label key={result.id} className="grid cursor-pointer grid-cols-[1.5rem_1fr] gap-3 bg-card p-4 transition-colors hover:bg-accent/40 sm:grid-cols-[1.5rem_1fr_auto]">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 accent-primary"
                      checked={isSelected}
                      onChange={() => setSelected((current) => isSelected ? current.filter((id) => id !== result.id) : [...current, result.id])}
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-bold">{result.title}</span>
                      <span className="block truncate text-sm text-muted-foreground">{result.artist}{result.album ? ` · ${result.album}` : ""}</span>
                    </span>
                    <span className="col-start-2 text-xs text-muted-foreground sm:col-start-auto sm:text-right">
                      {result.releaseDate?.slice(0, 4) ?? "Date unknown"}<br />{result.isrc ?? "No ISRC"}
                    </span>
                  </label>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/30 p-4">
              <span className="text-sm text-muted-foreground">{selected.length} selected</span>
              <Button
                disabled={!selected.length || importing}
                onClick={async () => {
                  setImporting(true);
                  try {
                    const result = await importRecordings({ data: { recordingIds: selected } });
                    toast.success(`${result.imported} imported, ${result.updated} updated`);
                    setSelected([]);
                    void queryClient.invalidateQueries();
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Catalog import failed");
                  } finally {
                    setImporting(false);
                  }
                }}
              >
                <Check /> {importing ? "Importing…" : "Import selected"}
              </Button>
            </div>
          </div>
        )}
      </section>

      <section className="mt-6 border-t pt-8">
        <div className="max-w-3xl">
          <h2 className="flex items-center gap-2 text-xl font-bold"><RefreshCw /> Real Last.fm data</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Removes all dummy/demo songs, artists and chart history, then re-seeds the site with Last.fm's
            top tracks from curated real artists (real names and real play counts) and rebuilds the chart.
          </p>
          <div className="mt-5">
            <Button
              variant="destructive"
              disabled={resyncing}
              onClick={async () => {
                setResyncing(true);
                try {
                  const result = await resyncLastfm();
                  toast.success(`${result.imported} real songs imported, ${result.entries} chart entries`);
                  void queryClient.invalidateQueries();
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Last.fm resync failed");
                } finally {
                  setResyncing(false);
                }
              }}
            >
              <RefreshCw className={resyncing ? "animate-spin" : ""} /> {resyncing ? "Resyncing..." : "Resync from Last.fm"}
            </Button>
          </div>
        </div>
      </section>

    </main>
  );
}

function Denied({ text }: { text: string }) {
  return (
    <main className="grid min-h-[70vh] place-items-center px-4 text-center">
      <div>
        <Shield className="mx-auto h-10 w-10 text-primary" />
        <h1 className="mt-4 text-3xl font-bold">Restricted area</h1>
        <p className="mt-2 text-muted-foreground">{text}</p>
        <Link to="/auth" className="mt-5 inline-block text-primary">Go to sign in</Link>
      </div>
    </main>
  );
}

