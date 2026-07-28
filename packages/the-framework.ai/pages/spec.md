Vike file-based route tree of the marketing site — four prerendered pages plus global head/config.

## TLDR

- `+config.ts` — global config: extends `vike-react`, `prerender: true`, default title/description, favicon.
- `+Head.tsx` — pre-paint package-manager restore script, Open Graph tags (`og:image` → `/banner.jpg`), IBM Plex fonts.
- `index/` — the landing page; also the site's de-facto component library (`ui.tsx`, `styles.css`, `TopNav`/`Footer`, `useCopy`, PM machinery) imported by the other pages.
- `banner/` — chrome-less 1200×630 page screenshotted into `public/banner.jpg` (the OG image).
- `go-to-dashboard/` — "the dashboard is local" explainer with run/install commands.
- `press/` — brand assets (logo, naming, banner regeneration, brand repo).
