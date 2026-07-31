Resume-on-demand for a stopped session (#1391): an action-bar button that continues the run without typing a message.

## TLDR

- Stop is pause semantics (kills the turn, keeps the worktree, publishes nothing) — but picking the work back up required typing into the composer (#762). The pause half had a button; this is the resume half, in the bar like "Merge PR".
- Pressing it sends the composer's own continuation (#720/#762): a `prompt` run with `resumeSession: <sessionId>` + `continueRunId: <runId>` (same row, same branch, same agent conversation), on the run's own agent (`agentForDriver`, #831).
- The message is `RESUME_MESSAGE`, a stock prompt mirroring the daemon's `RESUME_PROMPT` (#923) minus the restart framing: the agent has its whole conversation back — the one thing it is missing is why it stopped, and "the user pressed Stop" must not read as "the work was done".

## Facts

- Offered by RunView only when the run ended stopped AND a session id was reported (#1322) — without an id there is nothing any agent could resume.
- `useStartRun` owns busy/error: the daemon's `busy` refusal reads "A session is already active for this project."; a success hands `(RESUME_MESSAGE, runId)` to `onRunStarted`, which selects the run (a continuation keeps the feed — the reset tick holds, see +Page).

## Flows

- press → `sendStart(projectId, RESUME_MESSAGE, 'prompt', {resumeSession, continueRunId, agent?})` → `onRunStarted` → rail reload flips the row to running → the same view goes live without blanking.
