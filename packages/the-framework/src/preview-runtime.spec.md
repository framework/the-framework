The daemon's preview runtime (#475/#797): tracks one long-lived preview process per project (plus one per session that asks), serving the dashboard's Serve/Stop/status/targets handlers.

## TLDR

- `createPreviewRuntime({ homeId, resolveProject })` returns the `PreviewHandlers` set (`start`, `targets`, `stop`, `status`) plus `dispose()` (stop every live preview so dev servers do not outlive the daemon).
- Previews live in a `Map` keyed by `scopedKey(projectId ?? homeId, runId)` — since #797 the key carries the session, because a session serves its OWN worktree (keyed by project alone, a session's Serve booted the project checkout and showed code the session never wrote).
- Open is idempotent: an existing live handle is returned as-is; a preview is evicted the moment it stops serving (stop, or self-exit: crash / build error / user kill) so status never reports a dead URL and re-open restarts instead of handing back a corpse.
- `lastServeTarget` remembers the app last served per project (#651) so re-serving a monorepo picks it again without re-choosing.

## Problems

- Boot race: a second open can win the slot while the first is still booting — the loser stops its own handle and returns the winner's URL.
- Eviction race: the exit handler deletes the map entry only when it still points at the same handle, so a replacement preview is not evicted by its predecessor's exit.

## Decisions

- Split out of the project runtime: previews share nothing with the run half but the project resolver and the key scheme (the run half reaches in only to stop a finished run's preview).
- Serve targets are detected in the checkout that will actually be served (`resolveRunCheckout`): a session's branch may have added/removed a servable package, and offering the project's list would offer apps it cannot serve.
- The target memory is per project, not per session: which app you serve is a property of the repo. It is in-memory only — a live preview rehydrates via `status`, and the pick resets on daemon restart (the picker still lists everything).
- A stale/unknown remembered target id falls back to the root default (matched against the live target list).

## Flows

- open: `start(projectId, targetId, runId)` → existing handle? return it → `resolveProject` → `resolveRunCheckout` → resolve pick (explicit ?? remembered, matched against `detectServeTargets`) → `startPreview` → race check → track + remember target → `{ok, url, command}`
- evict: `handle.exited` → delete map entry (if still this handle)
- teardown: `dispose()` → stop all handles in parallel → clear map
