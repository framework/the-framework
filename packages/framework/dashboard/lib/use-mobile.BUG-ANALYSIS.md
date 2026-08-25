# Bug analysis: packages/framework/dashboard/lib/use-mobile.ts

## Business logic (high-level)

`useIsMobile` (SPEC: narrow means under 768px; the answer follows resizes; before the browser can
be asked the layout is treated as wide). Implementation: state starts `undefined` (rendered as
`false` via `!!isMobile`, i.e. wide-first — matches "the first paint never assumes the narrow
one"), and a mount effect installs a `matchMedia('(max-width: 767px)')` change listener plus an
immediate read.

Edge cases:
- jsdom / no matchMedia: guarded (`typeof window.matchMedia !== 'function'` returns early), so
  tests render wide instead of throwing. The `typeof window === 'undefined'` half is unreachable
  inside an effect (effects never run server-side) — harmless redundancy.
- Resize across the breakpoint: the `change` listener fires exactly at the 767/768 boundary and
  re-reads `window.innerWidth < 768`. Using `innerWidth` instead of `event.matches` is
  self-consistent: media queries and `innerWidth` both measure the viewport including the
  scrollbar in mainstream browsers, and the immediate `setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)`
  read uses the same measure, so the flip and the query agree at the boundary. The query at
  `max-width: 767px` vs the check `< 768` are the same predicate on integer px; on fractional
  device-pixel-ratio widths (e.g. innerWidth 767.5) the two could theoretically disagree by half
  a pixel, but the listener still fires on every boundary crossing and re-evaluates, so the value
  converges. Not a real-world defect.
- Cleanup: `removeEventListener` on unmount, no leak.
- `mql.addEventListener` requires a modern browser (Safari ≥14) — consistent with the rest of the
  dashboard's baseline; no fallback is warranted per the project's simplicity rule.

## Functions (low-level)

- `useIsMobile()` — inputs none; output boolean. Initial render false; after mount, tracks the
  breakpoint. Verdict: correct.

## Bugs found

None found.
