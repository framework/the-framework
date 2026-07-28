The daemon-side notification poll engine (#627): one generic loop that projects the registered projects into items and announces only what is genuinely new — shared by the "needs you" queue and the "New activity" feed, which differ only in projection and item identity.

## TLDR

- `SeenTracker<T>` folds each poll's items into a baseline keyed by the caller's `keyOf`; the first `observe` only seeds the baseline (returns `[]`), so whatever existed at daemon start-up is never announced.
- `startKeyedWatcher({projects, build, keyOf, onNew, intervalMs=60s})` polls immediately then on interval, hands only fresh items to `onNew` (empty polls skipped), and returns `{stop, poll}` — `poll` is exposed so daemon and tests can drive it deterministically.

## Decisions

- This fires with no dashboard open — that is what a Discord message buys over a browser notification; the browser has its own copy of the diff (via keys.ts).
- Reentrancy-guarded (`running`) and forgiving: a failed project scan or projection yields no new items that cycle.
- The interval timer is unref'd so it never keeps the daemon alive past shutdown.
