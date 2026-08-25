# Bug analysis: packages/framework/dashboard/lib/favicon.ts

## Business logic (high-level)

The working-state tab icon (#875, favicon.SPEC.md): `/logo.svg` idle, `/logo-animated.svg` while
an agent works (both exist in `dashboard/public/`; index.html emits the initial idle link). The
hook swaps the existing `<link rel~="icon">`'s href client-side.

SPEC-vs-code audit:

- "Only re-pointed when the state actually changes": two guards — the effect only re-runs when
  `working` flips (dep array), and the `getAttribute(href) !== href` check skips writing the same
  value (protects against the initial mount writing the idle href the shell already emitted,
  which per the comment would restart/refetch in some browsers). Correct.
- `rel~="icon"` attribute-word selector matches multi-token rels ("shortcut icon"). Correct.
- Missing link (no shell emit) → created and appended once; subsequent runs find it. Correct.
- `typeof document === 'undefined'` guard for non-DOM. Correct.
- Two instances of the hook mounted at once could fight (last writer wins per change) — App
  mounts it exactly once; reliance noted.

Relative-href nuance: the guard compares `getAttribute('href')` (the literal attribute, e.g.
"/logo.svg" as index.html wrote it) — not `link.href` (which would be absolutized and never match
the constant, defeating the guard). The right accessor was chosen; the test exercises exactly
this equality.

## Functions (low-level)

- `faviconHref(working)` — pure two-way pick. Correct.
- `useFavicon(working)` — see audit. No cleanup needed (the icon is global page state; reverting
  on unmount would flash). Verdict: correct.

## Bugs found

None found.
