The design gallery: a static set of pages, one per card, showing the dashboard's design foundations and components rendered in both themes, generated from the shipped components and the shipped stylesheet so the gallery cannot drift from the app. Nothing in the product serves the gallery; it is a reference for whoever designs the dashboard, published by a separate upload step outside this repository. `gallery.css` (the gallery's stylesheet entry, which imports the dashboard's own stylesheet unchanged) and `vite.config.css.ts` (the CSS-only build that compiles it) only wire that build and carry no business logic; `out/` and `.css-build/` are generated on every build and ignored by git.

## Context

**Problem**: a gallery maintained by hand drifts from the app the moment a component or a color changes, and then documents a design the app no longer has. A gallery generated from the very components and stylesheet that ship cannot drift, and the one place a hand-copy is unavoidable is flagged as such on the card.

## Business logic — TL;DR

- **The cards** (`previews.tsx`) - the registry of cards: four foundations (color tokens, status palette, type scale, radius scale), six components (button, badge, card, stat tile, disclosure with option label, tooltip and menu popup) and one pattern (empty states), each rendering the real shipped component, or a hand-copied replica flagged as such where the component cannot stand alone outside the running app.
- **The build** (`build.mts`) - `pnpm design:build` compiles the shipped stylesheet, renders every card to one self-contained static page under `out/` with a "Light" and a "Dark" pane, and regenerates the whole output every time, so nothing in it is ever edited by hand.
