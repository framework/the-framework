The direct prompt path (#331): `runPrompt` runs one fully rendered prompt through the driver, honoring its await gates — no scope/build scaffolding, no review loop; plumbing, not babysitting.

## TLDR

- Built for review-shaped presets like [Research]: the prompt operates on existing code, stops at `showChoices()`/`showMultiSelect()` + `<AWAIT>`, and continues from the user's answer (via `requestChoice`; a headless run resolves each gate to its defaults and continues).
- Emits the same `FrameworkEvent` stream a build run does (`session`, `system-prompt`, `driver`, `choice`, `usage`, `end`), so dashboard, store, and control channel (#344) work unchanged; resolves `{ text, events }`.
- Wires the full option surface: system prompt composition (#301/#326), transparent mode (#625), topic runs + project binding (#1120/#1121), live chat `messages` (#714), conversation recording (#908), resume of a finished run (#720), budget stop (#322), consumption gate (#531), eco section-dropping (#314), autopilot stance (#325), context dirs (#439), browser flag (#824), model override.

## Decisions

- The first prompt is sent raw (not wrapped in the rendered system template) in three cases: `transparent`, `antiLazyPill === false`, or resuming (#720) — a `--resume`d transcript already carries the framing, so re-wrapping would duplicate the system template. Resuming also skips the built-in system framing entirely.
- `emit` guards `onEvent` with try/catch (as `runFramework` does): it runs both inside and outside the main try (session-start and system-prompt fire first), so an unguarded listener throw would escape uncaught or skip the `end` event.
- Topic runs read the bindable project list through the same injected `bind` seam the gate resolves against, so no `node:fs` reaches this path (#1129).
- A declined plan (#358) ends the run cleanly (the decline controller is inert here); exhausted await rounds finish with the latest turn rather than looping, logging "await limit reached".
- The await protocol is always on — honoring the prompt's gates is the whole point of this path.

## Facts

- The run signal composes the caller's abort with the budget/consumption aborts (`createRunControls`, same wiring as a build run #322/#529).
- `endStopDetail` classifies the failure (user stop, budget, consumption, decline) into the `end` event's `stopped`/`detail`, and leaves a resume note in the workspace (`leaveResumeNote`) on stop.
- Turn signals (markdown views #441, session name, ready-for-merge — the #326 lifecycle signals) are non-blocking: none stop the turn.
- `messages` (live chat) keeps the run open after the prompt settles, each user message resuming the same session; unset means the run ends when the agent stops asking.

## Flows

- run: compose `TfContext` → (topic) `bind.listProjects()` → `composeRunSystem` → `emitSessionStart` + `system-prompt` event → `createRunControls` (budget/consumption abort composition) → `driver.start({cwd, system, model?, resumeSessionId?, signal, onEvent})` → `runAwaitRounds` (gate loop, chat, bind, record) → `end {ok:true}` → dispose
- failure: catch → `endStopDetail` (classify + resume note) → `end {ok:false, stopped?, detail}` → rethrow → dispose
