---
"@gemstack/framework": patch
---

Fix backlog turns dropping the agent's signals. The backlog loop prompts through the run's own driver session, so a backlog turn carries the same signal protocol as any other turn, but it only ever parsed await gates. `showMarkdown()` views never reached the dashboard rail, `setSessionName()` was ignored, and `setReadyForMerge()` never emitted `ready-for-merge`, so `--post-merge` could not fire from backlog work. The turn-signal parsing (views, session name, ready-for-merge) was duplicated verbatim in the build path and the direct prompt path and missing from the third; it is now one `createTurnSignalEmitter` used by all three, with the backlog loop sharing a single emitter so `ready-for-merge` still fires once across every item.
