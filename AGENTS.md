<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture

- Keep chart scoring isolated in `src/lib/chart-engine`; provider adapters supply raw metrics so external data sources remain replaceable.
- Keep third-party catalog credentials and requests inside authenticated server functions; browser code receives only normalized catalog DTOs.
- Use public server functions for chart reads and authenticated server functions for user actions so database policies remain the security boundary.
- Keep each shareable chart, artist, song, community, and administration experience on its own TanStack route for indexing and deep links.
