The shared await/choice/chat machinery (#304/#337/#339/#714): resolves the gates an agent turn ends on, re-prompts until it stops asking, and runs the stay-open live-chat phase — lifted out of the run lifecycle so run.ts, prompt-run.ts, and todo-loop.ts reach it without importing the orchestrator (which removed the run ⇄ todo-loop cycle).

## TLDR

- `resolveAwaitGate()` — one parsed gate → the user's answer text: emits `choice`, parks for the pick, maps picked id(s) back to label(s). Kinds: choices, multi, confirm (#358), browser (#796), bind-project / create-project (#1121).
- `drainGates()` — resolve → continue → re-parse, up to `MAX_AWAIT_ROUNDS`; a declined confirmation stops the exchange. `continueWith` is injected: raw `session.prompt` or a supervisor pass.
- `runChatPhase()` — live chat (#714): emit `settled`, wait for a message, resume the same session, drain its gates, record both turns (#908); repeats until the source resolves `undefined` (Stop / budget cap).
- `runAwaitRounds()` — opening prompt + drain + optional chat phase; `resume: true` makes the first message `--resume` a finished run's conversation (#720).
- `requestChoices()` / `requestMultiSelect()` — the gate primitives: emit `choice`, await the pick or fall back, emit `choice-resolved`.

## Problems

- A gate parked for input must never hang a stopped run: `raceChoiceOrAbort` resolves to the fallback on abort or rejection, never rejects, and removes its abort listener either way (user Stop, budget cap #322).
- Headless runs (no `requestChoice`) auto-accept the recommended option / default set, so a programmatic run stays deterministic.
- An invalid posted pick is coerced back to the recommended option / valid subset — junk can never resolve a gate to an id that was not offered.

## Decisions

- Round 0 keeps the stable per-kind gate id (`await-choices`, `await-confirmation`, …); later rounds get `-<round>` suffixes so a dashboard never confuses a re-ask with the answer it just resolved.
- The browser gate recommends "could not handle it" — the opposite of the confirm gate's Approve — because a headless run has nobody at the browser, and claiming a human cleared a login wall sends the agent back to a blocked page (#796).
- Bind-project options come from the registry, not the agent's block, so a gone project can never be offered (#1121); create-project's confirmation IS the filesystem-access grant, so it recommends Approve. Both only *record* the bind — the daemon watches for it and re-homes the run (#1122).
- One shared drain loop is why per-turn signal emission did not have to be added to three copies by hand (#563).
- Chat replies are attributed to the surface that asked (`via`, #917), so a Discord question and its answer read as one exchange; the recorded reply is the settled (post-gates) text (#908).
- `runChatPhase` reports the *last* chat turn's `exhausted` (#742): once chat runs, the opening drain's round cap is no longer the run's end reason, and a Stop-closed chat is not "exhausted" at all.

## Facts

- `recordMessage` is best-effort fire-and-forget — persisting must never stall or fail a run (#908); unset for headless runs.
- `bind` deps exist only for a project-less topic run (#1120); `addProject` validates (absolute, exists, directory) and never throws — an unusable path declines cleanly back to the agent.
- A chat user message is not echoed as a log line: it already shows as the driver's own `start` event (the YOU row).
- `NO_PROJECTS_TO_BIND` is the answer when no registry is wired or nothing is registered; the missing-project lookup after a pick is an unreachable-in-practice safety net (requestChoices coerces to a valid id).

## Flows

- opening: `runAwaitRounds()` → record user turn → `session.prompt(opening, {resume?})` → `emitTurnSignals` → `drainGates()` → record agent turn → chat phase or done.
- drain round: `parseAwaitGate(turn.text)` → `resolveAwaitGate()` → declined? stop : log choice → `continueWith(question, answer)` → `emitTurnSignals` → re-parse.
- chat turn: emit `settled` → `messages.next(signal)` → record user → `session.prompt(text, {resume: true})` → `drainGates()` → record agent → repeat, or end on `undefined`/decline.
- gate resolve: emit `choice` → race `requestChoice(req)` vs abort → coerce pick → emit `choice-resolved` → answer text.
