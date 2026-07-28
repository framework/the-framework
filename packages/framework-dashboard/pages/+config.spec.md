Global Vike config: client-only SPA with a prerendered static shell.

## TLDR

- `ssr: false` per #405 — the dashboard is a projection of local files behind localhost, not an SSR app; `extends: vikeReact` wires React; `Layout` is `layouts/LayoutDefault`.
- `prerender: true` emits a static `index.html` shell + assets so the daemon serves it as plain files with no Vike runtime (the single `/` route writes straight to `dist/client/index.html`).
- `favicon: '/logo.svg'` (#757) — the brand mark carries its own dark-mode ramp inside the file, because a favicon sits on browser chrome, which follows the OS theme, not the in-app theme choice.
