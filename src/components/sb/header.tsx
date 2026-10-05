import { Link, useNavigate } from "@tanstack/react-router";
import { Menu, Search, X } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyState } from "@/hooks/use-auth";

const NAV = [
  { to: "/charts", label: "Top 100" },
  { to: "/artists", label: "Artists" },
  { to: "/trending", label: "Trending" },
  { to: "/movers", label: "Movers" },
  { to: "/people", label: "People's Chart" },
  { to: "/genres", label: "Genres" },
  { to: "/countries", label: "Countries" },
] as const;

export function SiteHeader() {
  const { session, me } = useMyState();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const signOut = async () => {
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 md:px-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary font-display text-lg font-black text-primary-foreground">S</span>
          <span className="font-display text-lg font-extrabold tracking-tight">SONGBOARD</span>
        </Link>
        <nav className="hidden flex-1 items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className="rounded-md px-3 py-2 text-sm text-muted-foreground transition hover:text-foreground" activeProps={{ className: "text-foreground bg-accent" }}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link to="/search" search={{ q: "" }} aria-label="Search" className="grid h-9 w-9 place-items-center rounded-full hover:bg-accent"><Search className="h-4 w-4" /></Link>
          {session ? (
            <>
              {me?.isAdmin && <Link to="/admin" className="hidden rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground sm:block">Admin</Link>}
              <Link to="/profile" className="hidden rounded-full border px-3 py-1.5 text-sm hover:border-primary sm:block">Profile</Link>
              <button onClick={signOut} className="hidden text-sm text-muted-foreground hover:text-foreground sm:block">Sign out</button>
            </>
          ) : (
            <Link to="/auth" className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90">Sign in</Link>
          )}
          <button className="grid h-9 w-9 place-items-center rounded-full hover:bg-accent lg:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="grid gap-1 border-t px-4 py-3 lg:hidden">
          {NAV.map((n) => <Link key={n.to} to={n.to} onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm hover:bg-accent">{n.label}</Link>)}
          {session && <Link to="/profile" onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm hover:bg-accent">Profile</Link>}
          {me?.isAdmin && <Link to="/admin" onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm hover:bg-accent">Admin</Link>}
          {session && <button onClick={signOut} className="rounded-md px-3 py-2 text-left text-sm hover:bg-accent">Sign out</button>}
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-10 text-sm text-muted-foreground md:flex-row md:justify-between md:px-6">
        <div><span className="font-display font-bold text-foreground">SONGBOARD</span> — Where the numbers meet the people.</div>
        <div>All metrics shown are demo/sample data.</div>
      </div>
    </footer>
  );
}
