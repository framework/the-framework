Tests for `live-state.ts` — covers the event-stream selectors: view dedupe/update-in-place, choice open/resolve pairing, run liveness, current-run slicing, outcome, Actions URL extraction, and settledness.

## TLDR

- `agentViews`: first-seen order, re-shown id updates in place, non-view events ignored, and an extra field on the event flows through (the spread-not-hand-listed mapping).
- `currentRunEvents`: regression for the accumulated-feed bug — a new run's live view must drop the previous run's events, and a just-finished second run keeps its own `end`.
- `runOutcome` (#948): crash vs user stop vs clean finish, with `detail` carried.
- `actionsRunUrl`: only labels of the form `run <url>` count (a plain tool action like `Edit` is not a URL); the most recent run wins.
- `agentSettled` (#1173): a parked session is settled even though its process is still up (`status: running` for as long as the conversation is open, #714); a new driver `start` un-settles; an ended run is not "settled".
