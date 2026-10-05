import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { COUNTRY_LIST } from "@/lib/artists.functions";
import { Pager } from "@/components/sb/browse";

const PER_PAGE = 12;
const pageSearch = (s: Record<string, unknown>): { page?: number } =>
  typeof s["page"] === "number" && s["page"] > 1 ? { page: Math.min(Math.ceil(COUNTRY_LIST.length / PER_PAGE), Math.floor(s["page"])) } : {};

export const Route = createFileRoute("/countries")({
  validateSearch: pageSearch,
  head: () => ({
    meta: [
      { title: "Country Charts — SONGBOARD" },
      { name: "description", content: "Explore trending songs by country — see what's playing around the world." },
      { property: "og:title", content: "Country Charts — SONGBOARD" },
      { property: "og:description", content: "See which songs lead around the world." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  const { page: pageRaw } = Route.useSearch();
  const page = pageRaw ?? 1;
  const [filter, setFilter] = useState("");
  const matched = useMemo(
    () => COUNTRY_LIST.filter((c) => c.name.toLowerCase().includes(filter.trim().toLowerCase()) || c.code.toLowerCase().includes(filter.trim().toLowerCase())),
    [filter],
  );
  const totalPages = Math.max(1, Math.ceil(matched.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const list = matched.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);
  return (
    <main className="anim-rise mx-auto max-w-7xl px-4 py-12 md:px-6">
      <h1 className="text-5xl font-extrabold md:text-7xl">Country charts</h1>
      <p className="mt-3 text-muted-foreground">Tap a country to see its trending songs, straight from Last.fm.</p>
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Search countries…"
        aria-label="Search countries"
        className="mt-6 h-10 w-full max-w-md rounded-md border bg-card px-3 text-sm outline-none focus:border-primary"
      />
      {list.length === 0 ? (
        <p className="mt-10 text-muted-foreground">No countries match “{filter}”.</p>
      ) : (
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => (
            <Link
              key={c.code}
              to="/countries/$country"
              params={{ country: c.code }}
              preload="intent"
              className="flex items-center gap-4 rounded-lg border bg-card p-5 transition hover:border-primary"
            >
              <span className="text-4xl">{c.flag}</span>
              <div>
                <h2 className="text-xl font-bold">{c.name}</h2>
                <p className="text-sm text-muted-foreground">{c.code} · Trending songs →</p>
              </div>
            </Link>
          ))}
        </div>
      )}
      <Pager page={safePage} totalPages={totalPages} makeSearch={(p) => ({ page: p === 1 ? undefined : p })} />
    </main>
  );
}
