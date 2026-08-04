The whole CLI: flag parsing, subcommand dispatch, and — most of the file — one run's full lifecycle (`runBuild`) and its shared epilogue (`settleRun`).

## TLDR

- `runCli` is a pure dispatch table (doctor, relay, resume, daemon modes, stop, maintain, worktrees…); everything else falls through to `runBuild`.
- `runBuild`, in order: merge flags over config layers → preflight → run store + opening events → dashboard/control/relay wiring → pick the driver → consumption guard → compose the system prompt → run the build flow or the direct-prompt flow → settle.
- `createRunJournal` is the single event sink: it prints, persists, publishes, folds `LOGS.md` fields, tracks settle flags, and renames the run branch when the agent names its session.
- `settleRun` is shared by both run paths; cleanup (control channel, guard, browser stream, relay flush) runs in `finally`.

## Problems

- A daemon-spawned run has `stdio: 'ignore'` — every outcome, including skips, must be an event, or it happened silently.
- The dashboard renders only the tail after the last `session` event, so the browser port/URL must be held and re-emitted after it.
- Runs can abort in the window where `run.json` already says `running` but settle isn't wrapping yet — handled by a dedicated pre-driver abort path.

## Decisions

- **Settle order is load-bearing**: on-before-mergeable → auto handoff → finish `LOGS.md` → `store.close()`. Close archives the log, so anything appended after it misses the copy the dashboard's history reads.
- A **stopped run is not a failure**: exit 0, dashboard stays up, publishing and the quality step are skipped.
- Auto-handoff commits pending work *before* pushing — teardown's own commit happens after this process exits, and pushing first would publish a branch missing the last edits.
- Steerability keys on `--run-id` (a fact about this run), not on daemon status (a machine-global fact that was wrong in both directions).
- Merge is gated on the agent's ready-for-merge signal **plus** an empty session TODO — unless a human pressed Merge, which outranks the signal. A human Merge also resolves any parked "take more work?" gate with *stop*: merging answers that question.
- `--resume-session` on a build run is refused, not silently dropped; a default claude.ai session link is offered only for Claude — pointing a Codex run there would link to somewhere the run isn't.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
