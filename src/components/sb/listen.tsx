import { Youtube, Music2 } from "lucide-react";

// Keyless outbound links — no API key, no quota. YouTube search gives the
// best hit rate with "Artist - Title" (+ "official audio" bias).
export function buildListenLinks(artist: string, track: string) {
  const query = `${artist.trim()} - ${track.trim()}`.trim();
  const q = encodeURIComponent(query);
  return {
    query,
    youtube: `https://www.youtube.com/results?search_query=${q}+official+audio`,
    youtubeMusic: `https://music.youtube.com/search?q=${q}`,
  };
}

export function ListenSection({ artist, track }: { artist: string; track: string }) {
  const links = buildListenLinks(artist, track);
  return (
    <section className="mt-16 rounded-xl border border-dashed p-6">
      <h2 className="text-2xl font-bold">Listen to the song</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Play “{track}” by {artist} on YouTube.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <a
          href={links.youtube}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Search “${links.query}” on YouTube`}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-[#ff0033] px-5 text-sm font-semibold text-white transition hover:brightness-110"
        >
          <Youtube className="h-4 w-4" />
          Play on YouTube
        </a>
        <a
          href={links.youtubeMusic}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Search “${links.query}” on YouTube Music`}
          className="inline-flex h-10 items-center gap-2 rounded-full border px-5 text-sm font-semibold transition hover:border-primary hover:text-primary"
        >
          <Music2 className="h-4 w-4" />
          YouTube Music
        </a>
      </div>
    </section>
  );
}
