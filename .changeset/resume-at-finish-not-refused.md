---
'@gemstack/the-framework': patch
---

Resuming a session the instant it finishes is no longer spuriously refused as "already active". A run's row flips `done` the moment the child writes its ending, but the child takes a beat more to actually exit — and a Resume landing in that gap found the run's slot still holding a live pid and was turned away by the busy guard, though the session was over by its own account (the E2E settings story caught this on a slow CI runner). The start path now waits out a finished leg's exit and the retirement queued behind it — the settle chain is parked per run slot so the continuation can await it — and only then judges the guard, so a refusal is reserved for sessions that are genuinely still running and the checkout reuse always reads a settled archive.
