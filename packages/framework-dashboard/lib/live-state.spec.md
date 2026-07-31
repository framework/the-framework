Pure selectors deriving live-run UI state from a run's `FrameworkEvent[]` stream, kept React-free so they can be driven and tested on their own.

## TLDR

- The dashboard is a projection of the same `events.jsonl` the run writes; the interactive gate and the Stop button read this projection rather than any extra state.
- `pendingChoices` — open choice gates in fire order: a `choice` event opens (a re-fired id replaces in place), a matching `choice-resolved` closes; several can be parked at once (#440 shows them all in the right rail). An `end` event closes every open gate (#1359) — the meta fold's "a finished run is not awaiting anything" rule — so a run that died mid-gate (whose ending is the store's surrogate end, never a `choice-resolved`) stops rendering its question as answerable.
- `agentViews` (#441) — the agent's ad-hoc markdown rail views, one entry per id in first-seen order; a re-shown id updates in place rather than stacking a duplicate.
- `isRunActive` — anything streamed and no `end` event yet IN THE CURRENT SEGMENT (whether Stop is worth showing). A resumed session (#762) appends a second `session` boundary after its `end` to the same journal; "was there ever an end" read a resumed-live run as inactive and hid Stop.
- `agentSettled` (#785/#1173) — parked-on-you vs process-alive: `settled` sets it, a driver `start` clears it (answering puts it back to work), `end` clears it (over ≠ settled).
- `runOutcome` (#948) — how the run ended off the CURRENT segment's `end` event: `{ ok, stopped, detail? }`, so the overview pill tells a crash, a user stop, and a clean finish apart. Mid-resume there is no end in the newest segment yet and the answer is `undefined` — first-end-wins kept a resumed run "stopped" for ever, even after it later finished clean.
- `actionsRunUrl` (#1053) / `cloudSession` (#610) — external-run links parsed from driver `action` labels; last match wins across turns.
- `currentRunEvents` — the tail from the last `session` event, so a subscription spanning a run boundary does not show the previous run.

## Problems

- A settled session stays alive as a conversation (#714), so its status is `running` long after the agent finished — liveness cannot answer "is anything more coming?" (#1173). `agentSettled` reads the same rule the run's own meta folds off the stream, rather than being a second opinion.
- The live channel keeps one long-lived per-project subscription appending every event, but each run truncates `events.jsonl` and opens with exactly one `session` event (`emitSessionStart`) — so an accumulated feed can hold the previous run's log; `currentRunEvents` slices it off (a feed with no `session` yet is returned whole).

## Decisions

- `pendingChoices`/`agentViews` strip only the `kind` discriminant and spread the rest, so a field added to the event type flows through with no change here.
- Actions/cloud URLs are read from the event stream, not the run's meta, because the events are what a tab opened mid-run replays.

## Facts

- Label formats: the ActionsDriver emits `action` label `run <html_url>` once it finds its workflow run; the CloudDriver emits `cloud <url>` where the URL must match `https://claude.ai/code/session_<id>` (the id is captured).
