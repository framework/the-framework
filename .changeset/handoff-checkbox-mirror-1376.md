---
'@gemstack/the-framework': patch
'@gemstack/framework-dashboard': patch
---

The session header's handoff checkbox no longer lies about a push-only run (#1376). The run writes its `handoff-armed` state as the very first event — before the live channel attaches — so a live tab folds a stream without it and `handoffState`'s armed-armed fallback showed a ticked "Open PR" on a session the launcher had explicitly set to push-only. The armed pair was already mirrored onto the run record for exactly this reader; the view just never used it. `handoffState` now takes a seed, and `RunView` passes the record's mirror — a `handoff-armed` event in the stream still wins, being newer than any snapshot.
