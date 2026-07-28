Self-contained HTML reporter (#A5 Phase 5) — renders `SuiteReport[]` into one offline-safe HTML string with inline CSS/JS and no external assets.

## TLDR

- Page header aggregates totals across suites with pass-rate coloring (100% ok / ≥80% warn / else bad); each suite renders a stats line, optional `metadata` as a `<dl>`, and a case table.
- Each case row expands (click or Enter/Space, `aria-expanded` maintained) into a detail row showing input, response, score, and failure reason; expand/collapse is ~10 lines of vanilla JS.
- Every piece of user content (suite/case names, input, response, metadata) is HTML-escaped; responses render in `white-space: pre-wrap` `<pre>` blocks so long output wraps instead of scrolling horizontally.
- Dark mode via `prefers-color-scheme` CSS variables.

## Facts

- Missing `responseText` (agent threw or case skipped) renders a `<no response — agent threw or skipped>` placeholder.
- `formatLabel` special-cases `lastReviewed` → "Last reviewed"; other metadata keys are just capitalized.
- Output is safe to paste into a PR comment or open as a local file — that constraint drives the no-framework/no-asset design.
