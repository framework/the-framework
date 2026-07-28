Vike pages tree: global config plus the single catch-all page.

## TLDR

- `+config.ts` — SPA/client-only (`ssr:false`), `prerender: true` static shell, default Layout, `/logo.svg` favicon.
- `+Head.tsx` — IBM Plex Sans/Mono Google Fonts links (#1118), shared identity with the-framework.ai.
- `index/` — the one page: catch-all route, prerendered at `/`, `+Page.tsx` is the whole dashboard shell.
