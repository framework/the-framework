The dashboard's single Vike page: a catch-all route whose prerendered `/` shell the daemon serves for every path.

## TLDR

- `+Page.tsx` — the entire app shell: URL-driven selection (#784), shared polls, live event Channel, sidebar/main/right-rail composition.
- `+route.ts` — catch-all Route Function (`return true`); params deliberately unused, the page reads `urlPathname` itself.
- `+onBeforePrerenderStart.ts` — names `/` so the prerender emits `index.html` despite the Route Function deriving no URLs.
