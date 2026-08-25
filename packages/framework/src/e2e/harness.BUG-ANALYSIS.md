# Bug analysis: packages/framework/src/e2e/harness.ts

## Business logic (high-level)

The world the four story files run inside: the daemon's business logic wired exactly as `runDaemon`
wires it, but against throwaway state, with agent processes spawned through `fake-agent-bin.js`.
Everything a story touches goes through the real dashboard RPCs, real git repositories, and real
detached child processes — only the coding agent is scripted.

Responsibilities:

- **Process-global isolation.** `XDG_CONFIG_HOME` is re-homed at *module load* (L31), before any
  import-time registry read can resolve it. The comment explains why it must be per-file: the whole
  suite shares one config home, and story files run as sibling processes, so without this each
  file's cross-project rollups (`onProjects`, `onQueue`, `onOverview`) would see the others'
  registered projects. Correct placement — a `makeWorld()`-time assignment would be too late for
  any module that captured the path at import.
- **A world per story.** `makeWorld()` builds a temp home, a `ProjectRuntime` pointed at the fake
  agent binary, and a dashboard context that mirrors `startDashboard`'s wiring except for the two
  pieces the daemon runs as live loops (quota poller, auto-PM), which become mutable stubs a story
  drives directly.
- **Context re-binding per RPC.** `rpc(fn)` re-installs the world's dashboard context before every
  call, because the production code installs it once at start-up while a story process stands up
  several worlds in sequence.
- **Fixtures.** `addProject()` builds a real repo (init, identity, seed commit, bare `origin`) and
  registers it through the same `sendAddProject` RPC the Add-project dialog calls.
- **Synchronization.** `waitFor` (generic poll-until-defined), `waitAgent` (poll `onAgents` for a
  status), `waitRetired` (poll until the worktree is gone), `tailAgent` (live journal tail through
  the same relocating tailer the dashboard's `onEvents` uses).
- **Teardown.** `close()` stops tails, stops the agents the way daemon shutdown does, then waits out
  each agent's in-flight teardown by acquiring its `withAgentLock` key — the daemon's own
  serialization point — before deleting the state. That ordering is thought through: deleting repos
  under a mid-flight archive-commit-retire is what produced "cannot lock ref 'HEAD'" noise.

**Concurrency and ordering.** Within one story file, tests run sequentially (node:test's default),
so only one world is alive at a time and the process-global `FRAMEWORK_E2E_ARGV_FILE`,
`FRAMEWORK_FAKE_AWAIT`, and dashboard context are effectively single-owner. Two latent hazards
follow from that assumption and are worth naming even though nothing triggers them today: (a) two
overlapping worlds would fight over `FRAMEWORK_E2E_ARGV_FILE`, and the first `close()` would delete
it out from under the second world's children; (b) `withFakeAwait` deletes the variable in its
`finally` instead of restoring the previous value, so nesting two of them would disarm the outer
one. Both are unreachable in the current stories (every `makeWorld` is paired with a `close()` in
the same test, and no `withFakeAwait` nests), so neither is filed.

**Deliberate looseness that is correct.** `close()` swallows failures from `stopAgents`, `dispose`
and the `rm`s — teardown must not convert a real assertion failure into a confusing cleanup error.
`withAgentLock(worktreePath(...), async () => {})` cannot reject (the body is a no-op and the lock
chains on *settlement*, never rejection — `agent-locks.ts` L29-33), so the un-caught `Promise.all`
at L271 is safe.

**Leaks that do not matter.** The per-file `XDG_CONFIG_HOME` temp dir is never removed; neither is
it worth removing, since the process is about to exit and the OS reclaims `tmpdir`.

## Functions (low-level)

- **`git(cwd, ...args)`** — `promisify(execFile)` with the args as an array, so no shell and no
  quoting hazard even for paths with spaces. Rejects loudly on non-zero exit, which is what a
  broken fixture should do. Returns stdout only; stderr is dropped, which costs a little diagnostic
  detail on failure (execFile's error message already includes it). Verdict: correct.

- **`waitFor(read, what, timeoutMs = 30_000)`** — polls every 100 ms until `read()` yields anything
  other than `undefined`. Reads first, checks the deadline second, so a value already true at call
  time returns without waiting and a single slow read is never aborted mid-flight. `null` counts as
  a value (only `undefined` means "not yet"), which every caller respects. The defect is the failure
  message: `what` is a plain `string`, so a caller that interpolates mutable state into it (as
  `waitAgent` does) freezes that state at call time. See Bugs found. Verdict: bug found.

- **`withFakeAwait(mode, fn)`** — sets `FRAMEWORK_FAKE_AWAIT` for the duration of `fn`. Children
  inherit it at spawn, and every story spawns *inside* `fn` (the `startAgent` call is awaited within
  it), so the variable is still set when `spawn` captures the environment. `finally` clears it, so a
  later story's Starts do not inherit a gate. Verdict: correct.

- **`agentReady`** — a stub preflight that always passes, because there is no real agent CLI in an
  E2E run. Verdict: correct.

- **`makeWorld()`** — analyzed above. Note `binPath` is resolved from `import.meta.url` to
  `./fake-agent-bin.js`, i.e. the *built* sibling, which is right because the child is spawned as
  `node <binPath>`. `env: process.env` is passed by reference, so `withFakeAwait`'s mutation is
  visible to spawns that happen after it. Verdict: correct.

- **`world.spawnedSpecs()`** — reads the argv file, tolerates its absence (`.catch(() => '')`),
  drops blank lines, parses each as an `AgentSpec`. A malformed line would throw, which is the right
  loud failure. Verdict: correct.

- **`world.addProject(files)`** — real repo, per-repo git identity (so a machine without a global
  `user.email` still commits), default seed file when none given, `mkdir -p` for nested fixture
  paths, then a bare `origin` and the `sendAddProject` RPC. The bare repo is created *inside* the
  working tree and *before* registration, which is the one real defect here (see Bugs found).
  Returns `projectId(resolve(cwd))` — resolved, matching how the registry keys projects, so the id
  matches even when `tmpdir()` is a symlink (`/var` → `/private/var` on macOS). Verdict: bug found.

- **`world.startAgent(project, prompt, options, kind)`** — goes through `sendStart` and fails the
  story loudly with the RPC's own reason; records `{cwd, agentId}` for teardown. Verdict: correct.

- **`world.waitAgent(project, agentId, until, timeoutMs)`** — normalizes `until` to an array, polls
  `onAgents`, returns the meta once its status is wanted. Note it can return the *previous* run's
  terminal status when a story re-Starts the same agent id and immediately waits for `done` again;
  the stories that do this (`story-projects-and-settings` L89) follow up with a stronger wait on the
  second spawn, so the weak wait costs nothing. Verdict: correct.

- **`world.waitRetired(project, agentId, timeoutMs)`** — inverts `stat` into "gone yet?" and polls.
  A `stat` failure for any reason other than ENOENT would read as retired; unreachable for a temp
  path the harness owns. Verdict: correct.

- **`world.tailAgent(project, agentId)`** — wires `tailAgentEvents` to a plain array. Uses the
  relocating tailer, so a journal moved into the archive by teardown keeps streaming — the same
  seam `onEvents` rides, which is what makes the stories' feed assertions meaningful. Tails are
  registered for teardown; `stop()` is idempotent (`events-tail.ts` sets a `stopped` flag, and
  `followFile`'s stop closes an already-closed watcher and clears an already-cleared interval
  harmlessly), so the stories that call `tail.stop()` early and then `world.close()` are fine.
  Verdict: correct.

- **`world.close()`** — order: tails, `stopAgents(2000)`, per-agent lock drain, `dispose`, unset the
  argv env, remove home, remove repos. The lock drain is the piece that makes the story suite quiet;
  it is also the only part that could hang, bounded by nothing — but a stuck teardown is a genuine
  product failure worth hanging on rather than hiding. Verdict: correct.

## Bugs found

1. **L235** (`waitAgent`'s failure message): the message is an ordinary template literal evaluated
   when `waitFor` is *called*, but `last` is only assigned inside the poll callback that runs
   afterwards. So `JSON.stringify(last?.status)` is always `undefined` and every timeout reports
   `run <id> to be done (last seen: undefined)`, never the status actually observed — precisely the
   diagnostic the code goes out of its way to keep a `last` variable for. Concrete trigger: any
   story whose agent gets stuck in `failed` instead of `done` times out after 30 s with a message
   that hides the `failed` status, sending the reader to the wrong place. Severity: minor
   (diagnostics only, but it defeats the debugging aid for the slowest-to-diagnose failures this
   suite has). Fix sketch: widen `waitFor`'s `what` to `string | (() => string)` and resolve it at
   throw time (L109), passing a thunk from `waitAgent`.

2. **L210-211** (`addProject`): the bare `origin` repo is created *inside* the project's working
   tree and *before* `sendAddProject`. `installProject` (`install.ts` L48-52) begins with "commit
   pre-existing changes first": it sees `origin.git/` as untracked in `git status --porcelain` and
   runs `git add -A` + commit. A bare repo has no `.git` entry, so git does not treat it as a nested
   repository — it stages the whole skeleton (`HEAD`, `config`, `description`, `hooks/*.sample`,
   `info/exclude`, …) into the fixture's history, and from there into every agent worktree checked
   out from it. Contradicts the comment's own intent ("A bare repo standing in for `origin`"): the
   remote is fixture plumbing, not project content. No story assertion fails today, so the cost is
   noise in every fixture repo and a fixture that no longer resembles the real project it stands in
   for. Severity: minor. Confidence: medium. Fix sketch: create the bare repo outside the working
   tree — e.g. `const origin = mkdtempSync(join(tmpdir(), 'framework-e2e-origin-'))`, pushed onto
   `repos` so `close()` still removes it — and keep `git remote add origin <that path>`.
