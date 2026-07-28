One composer for a session, live or finished (#1026): the editor stays mounted across the run's lifecycle and only what a send does changes.

## TLDR

- Three send behaviors: running → `sendMessage` control entry the run drains between turns (#714); ended+resumable → `start` a fresh `prompt` run with `resumeSession: sessionId` and `continueRunId: runId` (#720/#762); ended without a session id → a plain new run carrying the text.
- A new-session preset (#959) always starts its own run in every state — drops the resume seed and run id, so it gets its own worktree/branch/transcript.
- A continuation resumes on the run's own agent, not the global pref (#831): `agentForDriver(driver)` maps driver name → agent name, `--agent` passed only when not claude; model is moot (the resumed transcript keeps its framing/model).
- `Note` says what a send will do; a successful live send shows "Queued — the session reads it between turns: …" since a queued control entry is otherwise invisible (#948); ended notes distinguish failed/stopped/ended via `outcome`.
- Wraps `Composer` with `showAgentModel={false}`, `inSession`, per-state busy label (Sending…/Resuming…/Starting…) and placeholder.

## Decisions

- Replaced the old RunChat/RunResumeChat pair: swapping components on run end remounted the editor mid-typing and left runs without a session id a dead end.
- The not-continuable message is the composer's *placeholder* (`NOT_CONTINUABLE`), not a note above the box: the message is about what typing here does, so it lives where you type — and is said only once.
- `sendMessage` resolves void; success is mapped to `true` to be distinguishable from `useAction`'s failure `undefined`.

## Flows

- live send: `send()` → `sendMessage(projectId, text, runId)` → setQueued + clear + refocus
- resume: `send()` → `start(projectId, text, 'prompt', {resumeSession, continueRunId, agent?})` → clear → `onRunStarted(text, runId)` (select the started run, #761)
- new session (preset or non-resumable): `start(projectId, text, 'prompt', {})` → clear → `onRunStarted`
