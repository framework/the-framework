One composer for a session, live or finished (#1026): the editor stays mounted across the run's lifecycle and only what a send does changes.

## TLDR

- Three send behaviors: running → `sendMessage` control entry the run drains between turns (#714); ended+resumable → `start` a fresh `prompt` run with `resumeSession: sessionId` and `continueRunId: runId` (#720/#762); ended without a session id → a plain new run carrying the text.
- A new-session preset (#959) always starts its own run in every state — drops the resume seed and run id, so it gets its own worktree/branch/transcript.
- A continuation resumes on the run's own agent, not the global pref (#831): `agentForDriver(driver)` maps driver name → agent name, `--agent` passed only when not claude; model is moot (the resumed transcript keeps its framing/model).
- `Note` says what a send will do; a successful live send shows "Queued — the session reads it between turns: …" since a queued control entry is otherwise invisible (#948); ended notes distinguish failed/stopped/ended via `outcome`.
- Wraps `Composer` with `showAgentModel={false}`, `inSession`, `sessionEnded={!live}` (#1172: ended brings back the gear as "Resume options" — the rows the next leg arms; live drops it), per-state busy label (Sending…/Resuming…/Starting…) and placeholder.
- The empty box's submit slot is the session's control (#1455), via `Composer`'s `idleControl`: **Stop** (square icon → `sendStop`, with the ⋮ menu's stays-"Stopping…"-until-`live`-flips latch) while the run is live; **Resume** (play icon) once the run ended stopped AND reported a session id (#1322) — the action-bar ResumeButton (#1391) relocated, sending the same stock `RESUME_MESSAGE` continuation (`resumeSession` + `continueRunId`, run's own agent). Typing swaps the slot back to the send ↑; ended any other way, the slot collapses as at the launcher.
- The Resume latch (#1460), Stopping's mirror: a pressed Resume holds the slot as a disabled busy Resume until `live` flips (or the row changes) — between the RPC resolving and the resumed leg's first event, `outcome` momentarily stops reading `stopped` and the slot used to flicker Resume → collapsed → Stop.

## Decisions

- Replaced the old RunChat/RunResumeChat pair: swapping components on run end remounted the editor mid-typing and left runs without a session id a dead end.
- The not-continuable message is the composer's *placeholder* (`NOT_CONTINUABLE`), not a note above the box: the message is about what typing here does, so it lives where you type — and is said only once.
- `sendMessage` resolves void; success is mapped to `true` to be distinguishable from `useAction`'s failure `undefined`.

## Flows

- live send: `send()` → `sendMessage(projectId, text, runId)` → setQueued + clear + refocus
- resume: `send()` → `start(projectId, text, 'prompt', {resumeSession, continueRunId, agent?})` → clear → `onRunStarted(text, runId)` (select the started run, #761)
- new session (preset or non-resumable): `start(projectId, text, 'prompt', {})` → clear → `onRunStarted`
