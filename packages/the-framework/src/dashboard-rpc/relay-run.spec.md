`relayOr`: run a run-scoped RPC locally, or forward it to the connected device when `contextRemote()` says this daemon is relaying that `runId` (#1067 slice 2).

## Decisions

- An unreachable device returns the caller-supplied `unreachable` value — the same empty/error shape `local()` gives on a failed read — so callers never special-case remote runs.
- For ordinary local runs the remote lookup is empty and `local()` runs unchanged.
