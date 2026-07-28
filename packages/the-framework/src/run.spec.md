The build-run orchestrator: `runFramework()` drives ai-autopilot's `Bootstrap` (scope → build → production-grade loop → deploy) entirely through a `Driver` session, then the backlog loop and live chat, streaming every phase as `FrameworkEvent`s.

## TLDR

- Composes the whole system channel once via `composeRunSystem` (#501), emits it as a `system-prompt` event (#343/#547 — nothing is appended after, so the text is the whole of it), and opens one driver session for the entire run.
- Wires `createRunControls` (caller signal + budget #322 + consumption #529 + plan-decline #358 self-stops) and `agentAwaitGate` — the turn-boundary gate that shows an agent's `await-*` question, waits for the answer, and re-prompts via `continueAfterChoice` (bounded by `MAX_AWAIT_ROUNDS`).
- Review policy: a domain preset's loop replaces the built-in checklist (#252) via `buildReview`; the build event kind (`bug-fix` vs default `major-change`, #265) picks which preset loop fires, falling back to the built-in checklist so a run is never left unreviewed.
- Serve gate (#229): provisions a `LocalRunner` (adopts cwd) or `DockerRunner` (throwaway container, source re-seeded via `snapshotWorkspace` before each check) so the checklist gates on the app actually booting; `keepAlive` leaves an `AppPreview` running for the caller to stop.
- After the build settles: the backlog loop (#323, default on for real drivers) and then the live-chat phase (#714, only when `messages` is wired).
- Detection only narrates ("Detected Vike") — nothing about it reaches the agent's prompt (#547).

## Problems

- Hand-off drivers (#1225): the prompt leaves the machine and the reply never comes back, so every phase after build would read the driver's own "handed off to <url>" summary as agent output — producing a bogus missing-verdict blocker and an unanswerable backlog gate. Fix: with `driver.handsOff`, checklist/improve steps are omitted (Bootstrap then skips its whole loop), the todo loop and chat phase are skipped, and a closing log explains the run continues in its own session.
- An empty workspace after the build turn means the agent stalled instead of scaffolding (#182) — unless the turn ended on an await block (#337/#339), in which case it stopped *on purpose* to ask and the scaffold retry must not clobber the question.
- The fake driver writes no files, so workspace verification and the todo loop are disabled for it to stay deterministic.

## Decisions

- `DEFAULT_MAX_PASSES` = 5, higher than ai-autopilot's 3: a from-scratch build spends its first pass or two bootstrapping an empty workspace (#182).
- Headless (no `requestChoice`): the build turn stands as-is rather than the gate auto-answering its own question; a declined plan aborts the run via `declineController` (the user takes over with fresh instructions).
- Topic runs (#1120/#1121): `bind` seams are threaded into the gate deps and the registered-project list is read through the same injected seam (no `node:fs` on this path) into the system channel.
- `preview` is only started with `keepAlive` (the serve gate otherwise boots the app just to check it); preview boot failure is non-fatal. The runner is disposed with the run unless it owns a live preview.
- `onEvent` throwing is swallowed (logged) — an observer must not break the run.

## Flows

- run: detect preset → compose system → `session` + `system-prompt` + detection/modes logs → controls → `driver.start` → buildReview → provision serve runner → `Bootstrap.run` (scope → build[awaitGate] → checklist+improve loop → deploy) → todo loop → keepAlive preview → chat phase → `end {ok:true}`.
- error path: `endStopDetail` classifies (stop vs failure, resume note on quota pause) → `end {ok:false, stopped?, detail}` → rethrow.
- await gate: base build turn → `emitTurnSignals` → `drainGates` (show choice → answer → `continueAfterChoice` re-prompt) → declined ⇒ abort / exhausted ⇒ proceed with latest turn.
- docker serve check: `snapshotWorkspace(cwd)` → write files into container → `serveCheck` (install/build/start/fetch) merged with the review checklist via `mergeChecklists`.
