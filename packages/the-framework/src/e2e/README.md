# Backend E2E story tests

Each test walks one dashboard user story through the real daemon runtime — real registry, real git repos, real spawned run processes — with the deterministic `--fake` driver standing in for the coding agent, so the whole flow runs offline in seconds and no browser is involved. They run as ordinary tests under `scripts/run-tests.mjs`, alongside the unit suites.

## What "end-to-end" means here

- **The entry points are the dashboard's own RPCs.** Stories call the same telefunctions the browser invokes over `/_telefunc` (`sendStart`, `sendChoice`, `onRuns`, `onQueue`, …), with the request context wired exactly the way `runDaemon` wires it: the runtime's `onStart`/`onAddProject`/`preview` closures, the registry-backed preferences store, and stub quota/auto-PM reporters where the daemon would hold live pollers.
- **Runs are real processes.** `createProjectRuntime` spawns each run detached, exactly as the daemon does; the harness's `binPath` points at `fake-agent-bin.ts` (compiled beside it), which forwards to the real CLI with `--fake` appended. Everything between the Start click and the archived run row — worktree allocation, the run store, `events.jsonl`, the control watcher, gates, teardown, retention — is the production code path; only the agent turn is scripted.
- **The Telefunc transport hop is out of scope.** Telefunc `Channel`s only pump over a real wire, so live-stream assertions ride `tailRunEvents` — the same tailer `onEvents` wraps. The mount, CSRF/rebinding guards, and channel plumbing have their own tests (`dashboard/server.test.ts`, `dashboard-rpc/stream-channel.test.ts`).

## Isolation

`harness.ts` points `$XDG_CONFIG_HOME` at a fresh temp dir per test process, so a story file's registry (projects, preferences, daemon state) can never see — or be seen by — the sibling test files running concurrently. Every world lives in temp dirs and `close()` kills whatever runs it spawned.

## Scripting the fake agent

`FRAMEWORK_FAKE_AWAIT=choices|multiselect|confirmation` (set before a Start; spawned children inherit the env) makes the fake agent's first turn end on that gate, which is how stories park a run on a question deterministically. Without it the fake agent answers every prompt with one scripted build turn and the run ends on its own.

## The finished-session seam

The publish and resume stories fire *at the moment* a run's meta flips `done` — inside what used to be a race window — and then assert teardown still retires the worktree. They are the regression tests for the per-run checkout lock (`run-locks.ts`) and the archive-following event tail (`events-tail.ts`). `waitRetired` remains for stories about the retired state itself.
