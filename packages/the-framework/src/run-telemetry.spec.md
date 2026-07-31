The run telemetry both entry paths share: session naming, driver-event accounting, self-stop plumbing, and end-of-run stop classification — extracted because it lived byte-identical in `run.ts` and `prompt-run.ts` (which is how the backlog loop ended up without turn-signal parsing at all, #563).

## TLDR

- `emitSessionStart()`: the opening `session` event; a literal `--session-link` shows right away, a `{sessionId}` template waits for the driver's real id.
- `createDriverEventHandler()`: wires the driver's black-box event stream (#165) into the run stream — re-emits `session-update` when the session id changes (it changes per prompt), folds each turn's usage into a `UsageMeter` total, and trips the budget (#322) and consumption (#529) self-stops.
- The driver's `session` announcement (#1322) is consumed here, never forwarded as a `driver` event: it emits the `session-update` at turn *start*, so a turn stopped or dying mid-flight keeps the run's `claude --resume` handle (the update used to wait for `result`, and the resume button vanished with the turn). Same id-change dedup as the result path; the template link applies, and a later result repeating the id does not re-emit (a cloud result's own deep link still wins on first sighting, as before).
- `createRunControls()`: composes the run's `AbortSignal.any` of the caller's signal + budget + consumption + plan-decline (#358) controllers, so everything downstream stops the same way whichever fired.
- `endStopDetail()`: classifies why the turn loop threw (caller stop / budget / declined plan / quota pause vs real failure) and renders the `end` event's `detail`; writes the resume note for a quota pause.

## Decisions

- Both self-stops fire *after* the turn that crossed them: its cost is already spent, so the point is to stop the next one.
- An agent that reports no price leaves `costUsd` undefined and so can never trip the budget cap (#540).
- A consumption gate that throws is treated as "carry on": an unreadable quota must not stop the work (#519); the gate answers from a cached reading because a live one spawns the agent CLI (~5s).
- A driver that knows its session's real URL (#1317, cloud hand-off) beats the `--session-link` template, whose Claude default is only the generic entry point.
- The resume note is written in `endStopDetail` (once `paused` is known), not at the trip: it is file I/O racing the run unwinding. `leaveResumeNote` is injected, not imported, to avoid a cycle with the todo loop.
- Budget-stopped/paused are only claimed when the caller's own signal did NOT abort, so a user Stop is never mislabelled.

## Flows

- driver event: on `session`: id change → `session-update`, consumed (no `driver` emit); else `emit(driver)` → on `result`: session-id change → `session-update`; usage → meter → `usage` event → budget check → abort; consumption gate → abort with trip label.
- run end (error path): `endStopDetail` → classify (declined > budget > paused > real error) → resume note if paused → `{stopped, detail}` for the `end` event.
