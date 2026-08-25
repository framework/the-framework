# Bug analysis: packages/framework/src/daemon-workspace.test.ts

## Business logic (high-level)

Tests `daemon-runtime.ts` (not `daemon.ts` despite the name): where a started agent is allowed to land, and what happens when its process dies. Per `daemon-workspace.test.SPEC.md`:

- **Shutdown refusals (#983)**: a Start after `stopAgents()` is refused, spawns nothing; a Start in flight when the stop lands (the test injects the stop inside the `driverPreflight` seam — the awaited gap) is refused *and* rolls back the worktree, the `tf-agent-*` branch and the written spec file.
- **Checkout rules (#997)**: a git repo whose `worktree add` fails refuses the start (never falls back into the user's checkout); a non-git project keeps the pre-#736 main-checkout fallback, signalled by the absent `agentId`, with a log line that distinguishes "not a repository" from "git failed"; a `CliTimeoutError` from `worktree add` removes the half-written directory while any other rejection leaves the path alone (`cleanupTimedOutWorktree`).
- **Boot deaths (#1261/#1654)**: a child that dies before writing `agent.json` gets a daemon-written failed meta (id = the worktree's run id, `startedAt` derived from the id, intent carried), the stderr tail in the event log plus the full stderr file, and a retained checkout; a child that wrote its own lifecycle is left alone (`markFailedStart` → false, no invented events); a gone checkout gets no marker and no directory.
- **Transient retries (#1281)**: `isTransientAgentFailure` names transport deaths only; `lastAgentFailureDetail` reads only the last `end` and only a failed one, tolerating malformed lines; a transient death is continued in the same checkout at most `MAX_TRANSIENT_RETRIES` times; a real failure is never retried.
- **Preflight (#1326)**: a logged-out driver refuses the start spending nothing; `target: 'actions'` skips the probe; a pass is cached across a burst; a failure is re-probed per start.
- **Slots (#1646)**: a held slot names the agent id + pid; `stopAgents` returns the same ids and clears the slot.

The tests genuinely pin these: each spawns through a real `createProjectRuntime` with stub CLIs whose observable writes (`started.log`, `spawned.log`, meta/events files) are polled with a 10s ceiling (`POLL_ATTEMPTS` × 20ms), and teardown uses retried `rm` (`RETRIED_RM`) to absorb the detached-spawn race the header documents (#1398).

Notes on test quality (not bugs per the ground rules):

- L197 `assert.deepEqual(await startedSpecs(log, 1), [], 'no run was spawned at all')` — a *negative* check through a wait-for-N helper: on the expected pass it polls all 500 attempts, a fixed 10s stall per suite run (the helper's own doc "the cap only ever costs time on a real failure" is untrue at this call site). Deterministic, within the 60s per-test budget — efficiency nit only.
- L310 `waitForSpecs` is a byte-for-byte duplicate of L61 `startedSpecs` and is **never called** — dead code in a project that prizes clean code. Style, excluded from the report.

## Functions (low-level)

- **`agentReady`** — resolved passing preflight. Correct.
- **`RETRIED_RM`** — `maxRetries: 10, retryDelay: 100`; absorbs ENOTEMPTY from daemon-side writes landing mid-teardown. Correct.
- **`writeStub(dir, log)`** — records the spec (whitespace-collapsed) read from `--agent`. Correct.
- **`POLL_ATTEMPTS` / `startedSpecs` / `waitForSpecs` / `waitForSpawns` / `waitForMeta` / `waitForLogLine`** — poll helpers returning as soon as the condition lands; all read with catch-to-empty so a not-yet-created file is a retry, not a throw. Correct (see the two notes above).
- **`withCapturedLog(body)`** — swaps `console.log`, restores in `finally`, returns joined lines. Correct.
- **`writeAgentMeta`** — a live meta with overridable fields. Correct.
- **`initRepo(prefix)`** — committed repo, realpath'd. Correct.
- **`writeDyingStub` / `writeLingeringStub` / `writeFailingAgentStub`** — boot-death, SIGTERM-obedient, and self-reporting-failure stubs; the failing stub writes its own `agent.json` + failed `end` with the injected detail and records `start`/`continue` per spawn, which is exactly what the retry tests need to tell a continuation from a restart. Correct.
- Test bodies — each asserts the specific contract listed above; the shutdown-refusal test's re-entrant `stopAgents` inside the preflight is the documented seam for landing a stop inside `onStart`'s awaited gap; the transient test additionally waits 400ms after the cap to prove no fourth spawn. All awaited; none vacuous. Correct.

## Bugs found

None found. (The 10s negative-poll stall and the unused `waitForSpecs` duplicate are noted above as efficiency/style, deliberately not reported.)
