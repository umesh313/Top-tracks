# SONGBOARD — Build Plan

Tagline: "Where the numbers meet the people." A dark, cinematic music-chart platform that mixes streaming, radio, public votes, social and search momentum into one SONGBOARD Rank. All data is demo/sample data (clearly labeled), with no outside music services needed.

## Stack adjustments to your brief
- Next.js / Prisma / PostgreSQL are replaced by this project's stack: TanStack Start (React + TypeScript + Tailwind + shadcn) with Lovable Cloud for the database, logins and server logic. Recharts, Framer Motion and Lucide stay.
- Same architecture intent: isolated scoring engine, provider abstraction with Mock providers, configurable weights stored in the database.

## Phases (built one at a time, verified after each)
1. **Foundation** — enable Lovable Cloud, design system (dark premium, original identity), app shell + navigation, sign up/login, full database schema with roles table (admin/user).
2. **Core music data** — artists, albums, songs, genres, countries, plus a seeded demo catalog (~150 songs, ~60 artists, 12 weeks of chart history).
3. **Chart engine** — Mock Streaming/Radio/Social/Search providers, normalization, weighted score (40/25/20/10/5 by default, editable), weekly chart generation, rank movement, momentum.
4. **Main pages** — Homepage (hero, Top 10, Trending, Movers, People's Chart, New, Top Artists, Genres), Global Top 100, Song detail (score breakdown, history charts, sentiment), Artist page.
5. **Community** — voting (one vote per user per song per week, signed-in only, rate-limited on the server), People Score, People's Chart, profiles, following.
6. **Discovery** — Trending, Biggest Movers, New Releases, Genre and Country charts, search.
7. **Gamification** — Song Battles, weekly predictions, badges, trendsetter score.
8. **Admin** — dashboard, edit songs/artists, edit weights, generate new chart, CSV import, moderation.
9. **Polish** — animations, mobile, accessibility, per-page SEO, share cards, empty/loading/error states, tests.

AI Chart Analyst: interface and placeholders built so it can be switched on later with Lovable AI.

## Technical details
- Scoring in `src/lib/chart-engine/` (pure functions, unit-tested); providers in `src/lib/providers/` behind a `DataProvider` interface.
- Tables: artists, albums, songs, genres, countries, song_metrics (weekly per provider), chart_weeks, chart_entries, scoring_config, votes (unique user+song+week), battles, battle_votes, predictions, badges, user_badges, follows, profiles, user_roles + has_role().
- Seed data inserted via migration; grants + RLS on every table; admin writes checked with has_role on the server.
- Reads via server functions + TanStack Query; each page its own route with head() metadata.
- Visual direction: before building UI I'll show 3 rendered design directions for you to pick from.

Since this is large, I'll ship Phases 1–4 first, then continue phase by phase.
