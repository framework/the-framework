Status: open
Priority: 2
Topics: [the-framework]
GitHub: [#1039](https://github.com/gemstack-land/the-framework/issues/1039)

# metaFromEvents anchors updatedAt to startedAt on replay

## TLDR

`metaFromEvents(events, startedAt)` folds every event with the same `startedAt`, so a rebuilt `RunMeta.updatedAt` equals `startedAt` instead of tracking the last event (the live path is fine — `RunStore.append` folds with `this.clock()` per event). No production caller consumes the stale value today, but the helper is on the public export surface, and its test's "reconstructs the same snapshot as live appends" claim can't be fully true for `updatedAt` since events carry no per-event timestamp. Surfaced during the framework quality pass (#1034).

## Why it matters

Any external or future internal caller reconstructing a meta via replay silently gets a wrong last-touched time. The fix is a design call, not a patch: either persist a per-event timestamp so replay is faithful, or document the anchoring behavior and drop the "same snapshot" claim. Low priority until something actually reads `updatedAt` off a replayed meta.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1039](https://github.com/gemstack-land/the-framework/issues/1039), created 2026-07-22, labels: `priority: low`, `the-framework ♻️`.

### Original description

`metaFromEvents(events, startedAt)` folds every event with the same `startedAt`, so the rebuilt `RunMeta.updatedAt` ends up equal to `startedAt` instead of tracking the last event. The live path is fine: `RunStore.append` folds with `this.clock()` per event.

Impact today: none. `metaFromEvents` has no production caller (only re-exports and its own unit test) so nothing consumes the stale `updatedAt`. But it is on the public export surface, so an external or future internal caller that reconstructs a meta this way silently gets a wrong last-touched time.

Also misleading: the test `metaFromEvents reconstructs the same snapshot as live appends` cannot be fully true for `updatedAt`, since events carry no per-event timestamp to replay.

Fix is a design call (events have no timestamps): either persist a per-event time to replay, or document that this helper anchors `updatedAt` to `startedAt` and drop the "same snapshot" claim. Low priority until something actually reads `updatedAt` off a replayed meta.

Surfaced during the framework quality pass (#1034).
