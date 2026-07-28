The dashboard's two read hooks — `useLoaded` (read once + on dep change) and `usePolled` (plus an interval and imperative `reload`) — both thin wrappers over one `useAsyncValue`.

## TLDR

- `useLoaded(load, initial, deps, keepPrevious?)` → value; `usePolled(load, initial, everyMs, deps, keepPrevious?)` → `{value, reload, loaded}`.
- `load: null` means "nothing to read yet" (e.g. no project selected): value stays `initial`, no read, no poll.
- `loaded` is true only after a successful read (and resets on dep change) — for callers that must tell "not there" from "not read yet" (#784).

## Problems

- Stale writes: a dep change or unmount retires the in-flight read via a per-effect `token.live`; `reload` reads the same token through `liveRef`, so an imperative refetch can't write back after either.
- This pattern was written out 12 times and only the usage panel remembered to `catch` — a daemon restart made every other tick an unhandled rejection.

## Decisions

- A rejected read keeps the last value rather than blanking it (deliberate, copied from the usage panel: an empty bar reads as "nothing used", not "no answer"); the next tick usually succeeds.
- A dep change resets to `initial` by default so panel B never shows panel A's data; `keepPrevious` opts out for the toolbar header (branch/PR/github), which updates in place instead of blanking and popping.
- `initial` is captured once in a ref (callers pass literals like `[]` that would be new every render), and it's also what a dep change resets to.

## Facts

- Contract: `load` must close over exactly `deps` — the caller owns the dep list (`react-hooks/exhaustive-deps` disabled on purpose).
