# Bug analysis: packages/framework/dashboard/lib/use-route.ts

## Business logic (high-level)

The route as state (#784): `useSyncExternalStore` over `window.location.pathname`, with a module
listener set woken by `popstate` (Back/Forward) and by our own `go()` pushes (the History API
fires no event for pushState/replaceState, hence the manual `notify()`). Server snapshot is `'/'`
(SPEC: "Before the browser takes over, the location reads as the dashboard's root").

Invariants checked:
- **Subscribe/unsubscribe balance** — the `popstate` window listener is added when the first
  subscriber arrives and removed when the last leaves. Multiple components share one listener;
  React calls the unsubscribe exactly once per subscribe. No leak.
- **No-op navigation adds no entry** — `go` compares `formatRoute(next)` against the snapshot
  `urlPathname` and returns early on equality. `formatRoute`/`parseRoute` (route.ts) are inverse
  for ids that are URL-safe by construction (registry-derived project ids, timestamp agent ids),
  and both sides percent-encode/decode consistently, so the comparison is reliable for every id
  the app produces. A stale `go` captured in a long-lived callback compares against the pathname
  of the render it came from — worst case a duplicate history entry for the same URL; `go` is
  re-created per render and consumed by fresh handlers, so this is theoretical.
- **replace vs push** — `replace` uses `replaceState` (the "adopting a started agent's id"
  correction), else `pushState`; both then `notify()`. Correct.
- **Query/hash** — `go` writes a path-only URL, dropping any search/hash. The dashboard's URLs
  carry no meaningful query (the `?token=`/`?draft=` bootstrap params are consumed and stripped
  before the SPA routes), so nothing is lost.

## Functions (low-level)

- `notify()` — iterates a copy-safe `Set` (deleting inside iteration is not done here). Correct.
- `subscribe(listener)` — add/remove with listener-count-gated window listener. Correct.
- `currentPath()` — reads `window.location.pathname`; on the server `useSyncExternalStore` uses
  the third argument instead, so no `window` access happens there. Correct.
- `useRoute()` — parses per render (cheap); returns `{route, go}`. `go(next, {replace})` as
  described. Verdict: correct.

## Bugs found

None found.
