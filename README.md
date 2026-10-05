# SONGBOARD — live music chart powered by Last.fm

## Development

You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Environment variables (secrets)

Create a local `.env.local` (git-ignored) with your secrets. Never commit real keys.

```env
LASTFM_API_KEY=your-last-fm-api-key
MUSICBRAINZ_ACCESS_TOKEN=your-musicbrainz-access-token
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
MUSICBRAINZ_USER_AGENT=SONGBOARD/1.0 (https://your-site.example)
```

> **For the deployed site**, set `LASTFM_API_KEY`, `MUSICBRAINZ_ACCESS_TOKEN`, and
> `SUPABASE_SERVICE_ROLE_KEY` in your hosting provider's environment variables
> settings (dashboard → project → environment variables). `.env.local` is
> local-only and is not deployed.

## Using real data (Last.fm)

Charts render live from Last.fm on every request — no admin step, no dummy data.
