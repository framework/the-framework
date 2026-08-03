The single `FrameworkEvent` union the whole run streams over — bootstrap narration, the wrapped agent's own progress, and framework-level status unified into one timeline (guardrail #2, #165) — plus the interactive choice-gate types.

## TLDR

- Event kinds: `session`, `session-update`, `system-prompt` (#343), `bootstrap`, `driver` (forwarded verbatim, never gated on), `preview`, `browser-stream` (#813), `browser` (#1455 item 6b), `log`, `view` (#441), `session-name` (#326), `ready-for-merge`, `on-before-mergeable` (#835), `handoff-armed` (#1102), `ticket` (#1117), `queue-entry` (#1253), `branch` (#1277), `handoff` (#1102), `settled` (#785), `bind` (#1121), `usage` (#322), `modes` (#272), `choice` (#304), `choice-resolved`, `end`.
- `ChoiceRequest` (#304): an interactive gate the run parks on until a pick arrives; variants: multi-select checklist (#332, pick resolves to a subset of ids), Approve/Decline confirm (#358), `autoAcceptMs` default 10s under autopilot, optional `file` for the doc sidebar.
- Skip-reason unions `OnBeforeMergeableSkip` (#835) and `AutoHandoffSkip` (#1102): every decline carries one, so "it was on and nothing happened" has an answer in the log.
- `AutoMergeOutcome` (#1216/#1363/#1418): `auto-armed` (GitHub holds the merge), `merged` (direct), `watched` (#1418: GitHub could not arm it and the checks have not passed — the daemon's CI watch merges on green; merging directly there is the lands-before-CI hazard, #1406), `withheld`+reason (#1363: armed but not authorized), `failed`+error.
- `ChoiceBy` = `user` | `autopilot` | `auto`; `pickedIds` normalizes single-id/subset picks; `OPEN_LOOP_MODES` = `['autopilot', 'technical']` is the single source for the mode checkboxes.

## Decisions

- We own this stream rather than surfacing the agent's transport directly (guardrail #2, #165); the dashboard and terminal render one timeline from it.
- Several facts are events rather than start arguments or stdout because *only an event reaches the run's meta*, and the meta is what a dashboard tab opened mid-run can read: `ticket`, `queue-entry`, `handoff-armed`. Likewise `on-before-mergeable` and `handoff` outcomes are events because a dashboard-started run is spawned with `stdio: 'ignore'` — an outcome that is not an event is an outcome nobody learns.
- `handoff-armed` carries the auto-merge arming too (`merge?`, #1382): it has no checkbox and never changes mid-run (#1216), but without it on the event the armed line and the meta said "draft PR" about a run configured to merge. Optional because older journals lack it; absent reads as off.
- `browser-stream` carries only the port: the dashboard reaches the stream through the daemon's proxy so the run's bridge stays unreachable from the web, and frames never enter the log — someone will type a password into that pane.
- `browser` carries only the URL (#1455 item 6b), same frames-never-enter-the-log rule: emitted for the first real (http/https) page the preview shows and on every change of page (a navigation in place or a tab switch), never for about:blank/chrome://, never twice in a row for the same URL. Re-emitted after each `session` so a continuation's rendered slice keeps a browser row; readers fold repeats of the same URL in place rather than stacking duplicates, like `view` re-shows.
- `branch` is observed off the checkout, emitted at start and again on rename; before it the branch was stamped only at teardown (#799) and earlier reads guessed among three naming schemes.
- `settled` marks the run parked on the user as a conversation (#714), undone by the next `driver` `start`, so "working or waiting for me" is answerable from the log rather than inferred from a status that only changes at the end.
- `queue-entry` exists because the drain's claim must outlive the sweep's memory: a daemon restart, or a hands-off run whose local process ends while a cloud session still works the entry.

## Facts

- `usage.costUsd` is absent when the agent reports tokens but no price (#540) — which is also when no budget cap can fire.
- `end` distinguishes `stopped` (user interrupt: Stop button / Ctrl+C) from failure, so surfaces show "stopped" rather than "failed".
- `session-update` re-emits when the id changes — each Claude Code prompt is a fresh session — keeping the session link current.
- `session` records the model the driver was started with (#1438), per leg: a continuation (#762) emits its own `session` event and may run a different model, so readers fold the latest rather than pinning the first; absent when the run left the agent on its own default.
- `view.id` is stable per title so re-showing a view updates in place instead of stacking duplicates.
- `AutoHandoffSkip.already-open` guards the one mistake the handoff must not make: opening a second PR for a branch that has one.
