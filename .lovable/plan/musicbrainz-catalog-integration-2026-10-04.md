# MusicBrainz catalog integration

## Build
- Add stable MusicBrainz identifiers to artists, albums, and songs so imports are deduplicated.
- Add a protected administration function that searches MusicBrainz from the server using the saved access token.
- Add a protected import function that validates selected recordings and creates or updates their artist, album, and song records.
- Replace the disabled import placeholder with a searchable MusicBrainz catalog picker and clear import results.

## Security and data quality
- Keep `MUSICBRAINZ_ACCESS_TOKEN` server-only and never return it to the browser.
- Restrict search and imports to authenticated administrators.
- Prefer MusicBrainz IDs and ISRCs for matching; retain the existing provider-based chart architecture.
- Label imported catalog records as real metadata while leaving existing chart metrics marked as demo data until real measurement providers are connected.

## Verification
- Run focused tests and confirm the administration flow renders without browser or build errors.
