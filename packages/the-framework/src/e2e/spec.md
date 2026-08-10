Backend end-to-end story tests: each test walks one dashboard user story through the real daemon runtime — real registry, real git repos, real spawned run processes — with the deterministic `--fake` driver in place of a coding agent, so the whole flow runs offline in seconds and no browser is involved.

## What "end-to-end" means here

- **The entry points are the dashboard's own RPCs.** Stories call the same telefunctions the browser invokes over `/_telefunc` (`sendStart`, `sendChoice`, `onRuns`, `onQueue`, …), with the request context wired exactly the way `runDaemon` wires it: the runtime's `onStart`/`onAddProject`/`preview` closures, the registry-backed preferences store, and stub quota/auto-PM reporters where the daemon would hold live pollers.
- **Runs are real processes.** `createProjectRuntime` spawns each run detached, exactly as the daemon does; the harness's `binPath` points at `fake-agent-bin.js`, which forwards to the real CLI with `--fake` appended. Everything between the Start click and the archived run row — worktree allocation, the run store, `events.jsonl`, the control watcher, gates, teardown, retention — is the production code path; only the agent turn is scripted.
- **The Telefunc transport hop is out of scope.** Telefunc `Channel`s only pump over a real wire, so live-stream assertions tail the run's `events.jsonl` — the very source `onEvents` wraps. The mount, CSRF/rebinding guards, and channel plumbing have their own tests (`dashboard/server.test.ts`, `dashboard-rpc/stream-channel.test.ts`).

## Isolation

`harness.ts` points `$XDG_CONFIG_HOME` at a fresh temp dir per test process, so a story file's registry (projects, preferences, daemon state) can never see — or be seen by — the sibling test files that run concurrently under `scripts/run-tests.mjs`'s shared config home. Every world lives in temp dirs and `close()` kills whatever runs it spawned.

## Scripting the fake agent

`FRAMEWORK_FAKE_AWAIT=choices|multiselect|confirmation` (set before a Start, spawned children inherit the env) makes the fake agent's first turn end on that gate, which is how stories park a run on a question deterministically. Without it the fake agent answers every prompt with one scripted build turn and the run ends on its own.

## Two product races these stories surfaced — and now pin down

Writing the stories surfaced two real windows in the finished-session seam. Both are fixed in the product, and the stories are their regression tests:

- **Acting on a run the moment its meta flips `done` used to race teardown.** The child writes `status: done` and exits; the daemon then archives the history, commits the bookkeeping to the run branch, and retires the worktree. A Push/Resume fired inside that window ran its own commit against the same checkout, the loser reported "could not commit the work this session left uncommitted", and a losing teardown stranded the worktree. Now every mutator of one run's checkout — teardown, the handoff's commit step, Remove/Delete, continuation reuse — serializes on the run lock (`run-locks.ts`). The publish and resume stories act *at* `done` on purpose; `waitRetired` remains for stories about the retired state itself.
- **A live tail whose file was retired used to go silent without the final events.** Teardown *moves* `events.jsonl` into the archive; when fs.watch missed the last appends, the 1s poll found the file gone and delivered nothing again — including the `end` the transcript needs. `tailRunEvents` (events-tail.ts) now re-resolves the journal's home when the tailed file disappears and carries its read offset across the move — the archive is a verbatim copy, so exactly the missed lines arrive, once. `onEvents`, the relay tail, and this harness's `tailRun` all ride it.
