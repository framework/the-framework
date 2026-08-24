# Bug analysis: packages/framework/dashboard/design/build.mts

## Business logic (high-level)

The design-gallery build: compile the app's Tailwind (via the CSS-only vite config) to one
stylesheet, then render every `PREVIEWS` card with `renderToStaticMarkup` into a self-contained
HTML file showing the component in both themes (light pane, and a `.dark`-classed pane relying on
the stylesheet's dark variant), for DesignSync to upload from `design/out/**`. Cards are static —
hover/open states are separate rendered instances, matching the header comment.

Pipeline audit:

- `compileCss()` runs the vite build into `.css-build`, recursively collects every `.css` file,
  concatenates, and *fails loudly* on empty output ("gallery CSS build produced nothing") — the
  exact guard that keeps a silently-broken Tailwind build from producing unstyled cards. Correct.
  (The vite build also emits a JS stub for the CSS entry; only `.css` files are read, so it is
  ignored.)
- Ordering: css compiled → `rm(outDir)` → write all cards → `rm(cssBuildDir)`. A throw mid-loop
  leaves a partial `out/` and a stale `.css-build/` — acceptable for a build script that exits
  nonzero; the next run `rm`s both (`emptyOutDir` cleans `.css-build`, `rm(outDir)` cleans out).
- `page()` interpolates `preview.name/subtitle/group` and the rendered body into HTML without
  escaping. All values are compile-time literals from previews.tsx (no user input), so no
  injection surface; a future name containing `&`/`<` would render wrongly, but that is authoring
  data. Reliance noted, not a bug.
- The `<!-- @dsCard group=… -->` comment precedes `<!doctype html>`: comments before the doctype
  are legal and do not trigger quirks mode, so the metadata trick is safe.
- Theme panes: the dark pane gets the `dark` class on the pane wrapper; inside, the surface div
  carries `bg-background text-foreground` so the pane paints the theme's canvas. The wrapper div
  reuses the `ds-pane-body` class with an inline `padding:0` override, then nests the real padded
  body — slightly odd but correct CSS (inline style wins).
- `renderToStaticMarkup(preview.node as never)` — hooks with initial state render fine; nothing
  in the registry needs effects to look right except the flagged replicas, which is exactly what
  the `replica` badge communicates.

## Functions (low-level)

- `compileCss()` — see audit; `walk` handles nested asset dirs. Verdict: correct.
- `CHROME` — namespaced `ds-*` classes so gallery chrome cannot collide with app styling.
  Correct.
- `page(preview, css)` — body rendered once, embedded in both panes; two `<style>` blocks (app
  css then chrome). Verdict: correct.
- Top-level script — sequential awaits; `mkdir recursive` per card path supports grouped
  subdirectories. Verdict: correct.

Note: `Preview.width`/`height` are never read here (only `group` reaches the output, via the
@dsCard comment) — see the previews.tsx analysis.

## Bugs found

None found.
