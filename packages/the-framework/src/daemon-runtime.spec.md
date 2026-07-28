The daemon's per-project business logic (#393/#736): spawning runs as detached children into per-run git worktrees, topic runs and re-homing, project install, previews, remote relays, transient-death retries, and shutdown suspension.

## TLDR

- `createProjectRuntime({cwd, env, binPath})` → `ProjectRuntime`: `onStart` (spawn a run), `onAddProject` (install + register), `preview` handlers (#475/#797), the #1067 relay surfaces (`remoteEventsSource`, `tailRelayEvents`, `remoteRuns`, `onRelayRpc`), `activeRunCount` (#685), `suspendRuns` (#923), `dispose`.
- Each run gets its own worktree at `.the-framework/worktrees/<runId>` on branch `the-framework/run-<runId>` with the parent's `node_modules` symlinked in (#738); a non-git project falls back to the main checkout and keeps the pre-#736 one-run-at-a-time guard.
- Runs are spawned detached (`node <bin> <prompt> … --no-dashboard --cwd <worktree> --run-id <id>`), stderr to `.the-framework/stderr.log` (#1261); the run narrates itself via its own `events.jsonl` — the daemon only tracks liveness in `activeRuns`.
- Teardown archives the run's history into the repo, then removes the worktree only for a clean `done` whose pending work committed; failed/stopped runs keep their checkout for inspection (removed only explicitly).
- Topic runs (#1120): project-less runs in a scratch dir under the config home, keyed `@topic`; a `bind` event in their own log triggers `rehomeTopicRun` (#1122) — fresh worktree in the bound project, history moved, same agent session resumed, scratch removed.
- Transient deaths (dropped connection, 5xx, rate limit) earn up to `MAX_TRANSIENT_RETRIES` (2) auto-continues after 15s (#1281).
- `startOptionFlags` translates dashboard Global options into CLI flags; a default start is byte-identical to before.

## Problems

- Re-exec safety: `resolveSpawnBin` refuses a `process.argv[1]` that is a test file — under `node --test` re-invoking it re-runs the whole suite, which calls back here: a fork bomb.
- A SIGTERMed `git worktree add` removes its own admin entry but leaves the partial checkout, so `prune` finds nothing; only a timeout kill is cleaned up (`cleanupTimedOutWorktree`) — any other rejection may be git refusing a path that pre-existed and is not ours to delete (#997).
- Boot deaths (#1261): with stdio detached, a child that crashes before opening its store leaves the session page polling forever; the daemon's exit handler writes a minimal `failed` meta plus the stderr tail (`markFailedStart`) — but only when the child wrote no meta of its own. stderr goes to a file, never a pipe: a detached child must not block on a dead parent's pipe buffer.
- Async start gap: the `starting` set reserves scoped keys mid-spawn so two Starts cannot race the same checkout.
- Re-home vs teardown race: `markRehomed` fires before the scratch child is stopped, so the child's exit handler leaves scratch removal to the re-homer instead of racing it.

## Decisions

- A git repo whose `worktree add` failed does NOT fall back to the user's checkout (#997): that downgrade silently pointed the agent at their uncommitted work — the one thing #736 exists to prevent. The run fails instead (a failed run is restartable; a polluted checkout is not). Reachable in normal use: `worktree add` on a large repo can outrun its budget and be SIGTERMed.
- Concurrency is per run, not per project: worktrees removed the collision, and Rom's call on the cap is unbounded — the guard only refuses a duplicate of the *same* checkout (in practice, the fallback path).
- Continue-run (#762) re-attaches by the run's *recorded* branch first (#1277): an agent that branched itself would otherwise be continued on a branch missing its previous commits. Archived history is restored into the checkout so the run reopens as one row.
- Retry counters live in memory on purpose (#1281): a daemon restart already re-resumes runs (#923), and a lost count only grants one extra attempt. Only local runs that failed by their own `end` event with a `TRANSIENT_FAILURE`-matching detail retry; boot deaths never (retrying a run that cannot boot just re-crashes); stopped stays stopped; web/actions runs are not this daemon's to replay.
- A relayed remote run (#1067) gets a memory-only `RunMeta` stub (`target: 'remote'`), never written to disk; the device owns its lifecycle. `remote` is stripped before forwarding so the remote starts an ordinary local run.
- `suspendRuns` leaves out runs that finished (`done`) while being asked — nothing to resume; a fallback run (no worktree/run id) is stopped and no more. The queue-entry pin travels with the suspended record (#1268).
- Tri-state flags (#841/#842): explicit `false` emits `--no-*` so a launcher start can turn off what the repo file turned on; `autoPushBranch`/`autoOpenPr` default ON so `false` must be said out loud (#1102). Only vetted values are forwarded: ticket paths re-checked (`isTicketPath`), `via` must pass `isSafeVia`, queue entries passed verbatim via argv (never a shell).
- `tearDownTopicScratch` applies the same retention rule as worktrees: clean `done` → remove; failed/stopped/unreadable → keep for inspection.

## Facts

- Run keys are `scopedKey(projectKey, runId)` (`<projectKey>::<runId>`), bare project key for fallback runs; topic runs use `@topic`, which can never equal a real project id (projectId always appends `-<hash>`).
- `TRANSIENT_FAILURE` matches: connection closed/reset/error, econnreset, etimedout, socket hang up, overloaded, rate-limit, `api error: 5xx`, internal server error. `lastRunFailureDetail` reads the *last* `end` event of the archived jsonl; only a child-written `end` counts.
- `activeRunCount` re-checks `isPidAlive` rather than trusting the map — a lost exit event would otherwise keep a project looking busy forever.
- `RETRY_PROMPT` tells the continued session it died to a transient error and to carry on (the #923 resume-prompt shape); retries are forced `unattended`.
- `onAddProject` resolves relative input and stats the directory first — a bad path would otherwise reach git as a missing cwd and surface as the confusing "spawn git ENOENT".

## Flows

- start run: (remote? → `startRemoteRun` + register stub) / (topic? → `onStartTopic`) → `resolveProject` → continue (`continueWorkspace`: reattach worktree by recorded branch + restore archive) or allocate (`addWorktree` + `linkDependencies` + `excludeDependencyLinks`) → busy-guard on scoped key → `spawnDetached` → on exit: `markFailedStart`? → `tearDownWorktree` (stop preview → record branch → archive under user dir → `commitPendingWork` → `removeWorktree` + prune) → `retryTransientDeath`.
- topic run: mkdir scratch + `.the-framework/` (so the bind watcher's fs.watch attaches before the run's first write) → `spawnDetached(--topic)` → `tailEvents` for `bind` → `rehomeTopicRun`: resolve project → read sessionId → allocate worktree → `markRehomed` → terminate scratch child → `moveTopicRunHistory` (events copied; meta rewritten with `topic` cleared + `boundProjectId`) → spawn continuation (`--continue-run --resume-session`) → rm scratch. Failed re-home retains scratch + logs into the run, watcher stays armed for a later bind.
- suspend (shutdown): for each active run: `terminate` (SIGTERM→SIGKILL) → skip `done` → collect `{runId, suspendedAt, sessionId?, queueEntry?}` per project → `writeSuspendedRuns`.
- relay: dashboard events for a relayed run come from `RelayedRuns`; `/_relay/events` tails a local run's jsonl back to the relaying daemon; `onRelayRpc` dispatches whitelisted RPCs against the home checkout.
