The `the-framework.ai` marketing website — a private, fully prerendered Vike + React 19 static site.

## TLDR

- `pages/` — Vike routes: `/` (landing), `/banner` (OG-image source), `/go-to-dashboard`, `/press`; global `+config.ts` (`prerender: true`) and `+Head.tsx`.
- `public/` — `CNAME` (`the-framework.ai`, GitHub-Pages-style custom-domain deploy), `banner.jpg` (screenshot of `/banner`), `assets/` (`logo.svg` + eight `emoji-*.svg` static Noto emoji used by `ui.tsx`'s `Emoji`).
- `vite.config.ts` — react + vike plugins, with a `vitePluginServerEntry.disableAutoImport` workaround for a Vike bug (#460).
- `package.json` — named `__private__website`, not published; scripts `dev`/`build`/`preview`/`typecheck`; deps only react/react-dom/vike/vike-react.

## Facts

- No server code and no CSS framework: fully static output; styling is inline-style-first with one shared `pages/index/styles.css` for hover/pseudo/media/`data-pm` rules.
- The package-manager choice (npm/pnpm/bun/yarn command variants) is a pre-paint `<html data-pm>` + CSS mechanism spanning `+Head.tsx`, `index/Hero.tsx`, `index/styles.css`, and `go-to-dashboard/+Page.tsx`.
