`useRunHandoff(projectId, runId, enabled?)` — the polled handoff read (branch state: what to push / whether to open a PR) lifted out of its panel so the action bar's summary+actions and its expanded commits/files detail share one answer.

## TLDR

- Wraps `usePolled(onRunHandoff)` + `useAction`; returns `{handoff, loaded, busy, error, pending, act}`.
- `act(which, fn, fallback)` marks which button is in flight (`'push' | 'pr'`) so the UI can say "Pushing…" rather than silently greying (#948), and `reload`s on success so the action's effect lands immediately.
- `loaded` prevents flashing an empty state before the first answer.

## Decisions

- Polled rather than read once: a push or PR opened here or from a terminal changes what to offer. Reading once for two consumers also halves the polling.
- Not read while the run is live (#1026): a branch still being written to has nothing to hand off — `enabled` gates the load.
- Adaptive cadence (#1028): 15s at rest, but 1s while `handoff.prPending` — a PR lookup still in flight holds the Push / Open PR offer back, so that one is worth re-asking straight away.
