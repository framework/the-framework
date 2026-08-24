# Bug analysis: packages/framework/dashboard/design/vite.config.css.ts

## Business logic (high-level)

The CSS-only vite config the gallery build (build.mts) invokes: Tailwind v4 plugin, `gallery.css`
as the sole rollup input, output into `design/.css-build` (URL-resolved beside this file, so the
cwd the build runs from does not matter), `emptyOutDir: true` so stale hashed assets from a prior
run cannot be concatenated twice by build.mts's walker. `logLevel: 'warn'` keeps the gallery
build's output readable. Deliberately not the app's vite.config.ts (no React plugin, no dev
server) — producing CSS is the whole job.

Failure modes considered: a missing `gallery.css` fails the vite build loudly (build.mts then
exits nonzero); Tailwind emitting nothing is caught downstream by build.mts's empty-CSS guard.
The `emptyOutDir` flag also avoids vite's outside-root warning becoming an interactive prompt.

## Functions (low-level)

- Default export (`defineConfig({...})`) — configuration only; both paths built with
  `fileURLToPath(new URL(..., import.meta.url))`, which is correct cross-platform (Windows
  drive-letter safe, though this repo targets linux). Verdict: correct.

## Bugs found

None found.
