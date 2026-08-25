# Bug analysis: packages/framework/src/merged-worktrees.test.ts

## Business logic (high-level)

Three layers of coverage for the E5 sweep:

1. **The per-project pass over fakes** (`fakeSweep` + `row`): which candidates are offered to the
   removal, and what the result shape is. Pins the exclusions (live, busy), the once-per-project
   remote question, the failure passthrough, and the "a listing that throws sweeps nothing" path.
2. **The project loop over a stubbed `sweep`**: the wording of removal/retention lines, the
   announce-once accounting and its three state transitions (same reason, changed reason, removal
   clears), `stop()`, and per-project error isolation.
3. **Real git**: a temp repo with a bare `origin`, a session worktree with its own commit, and
   assertions about what survives. This is the layer that answers "is the work still there
   afterwards", which no fake can.

Behaviours the tests genuinely pin (each assertion can fail if the behaviour is removed):

- No outcome pre-filter: a `failed` run's checkout is offered to the rule just like a `done` one -
  `asked` records the exact ids and the order.
- `busy` exclusion is separate from `live` exclusion; both are asserted by observing `asked`.
- The no-remote path is asserted three ways at once: `remoteChecks === 1` (asked once, not per
  row), `asked` empty (no doomed push), and one `failed` row per candidate with the exact reason
  string. This is the strongest test in the file.
- Announce-once: the `changed reason` test uses a three-outcome script where outcomes 2 and 3 are
  identical, so a naive "dedup on agent id only" implementation yields 1 line and a correct one
  yields 2 - the assertion distinguishes them. The `removal clears` test likewise scripts
  keep/remove/keep and asserts 2, which a non-clearing implementation would answer with 1.
- `stop()`: `swept` counts sweep invocations across a tick before and a tick after `stop()`;
  asserting `1` fails if the stop flag is not consulted in `tick`.
- Error isolation: `/bad` throws, `/good` must still be swept.
- Real git: after a successful pass, `stat(path)` rejects (checkout gone) *and* the branch ref
  still resolves to a 40-char sha *and* both the local branch and `refs/remotes/origin/<branch>`
  carry the session's commit. The "work is in two places, not none" claim is fully checked, not
  asserted by proxy.
- Uncommitted work: `notes.txt` is written into the checkout and never committed by the test;
  after the pass it must be readable via `git show <branch>:notes.txt` *and*
  `refs/remotes/origin/<branch>:notes.txt`. This is the test that would catch a removal that
  force-deletes a dirty tree.
- Already-pushed: an explicit `push --set-upstream` before the pass, then the checkout must still
  go - covering the `branchPushed` short-circuit.

Gaps worth naming (not bugs): nothing exercises `describeDeleted` with a single branch through the
log line (only the two-branch wording is asserted); nothing drives the real-git path with a `busy`
set; and no test covers a `remove()` that *throws* rather than returning `{ok:false}`, which is the
one uncaught path in the module.

## Functions (low-level)

### `fakeSweep(rows)`

Builds a `removeMergedWorktrees` invocation over fixed rows with `hasRemote: true` and a recording
`remove`, returning `{ asked, agent }`. `over.remove` lets a test override the outcome while still
recording the id. Correct; the recorded order is the loop order, which the first test asserts.

### `row(over)`

`{ live: false, ...over }` typed as `WorktreeRow`. Sound because `WorktreeRow` only requires
`agentId` and `live`; `over` can override `live`, which the live-session test uses. Correct.

### `repoWithAgentWork(opts)`

Real fixture: `mkdtemp` + `realpath` (the macOS `/var` -> `/private/var` symlink would otherwise
make git's reported paths differ from the test's), `git init`, a local identity so commits work
without a global config, one initial commit, optionally a bare `origin` *outside* the repo dir, then
`addWorktree(repo, {agentId: RUN_ID, branch: agentBranchName(RUN_ID)})` and a commit inside the
worktree. Returns `{repo, path, branch}`.

Edge notes: the fixed `RUN_ID = 'run1'` is safe because each repo is its own `mkdtemp`; the origin
name is disambiguated with the mkdtemp suffix, which is what keeps parallel test files from
colliding on it. But see the bug below - the origin directory is created as a *sibling* of the
temp repo and no test removes it.

### The three assertion-only tests over `startMergedWorktreeSweep`

`lines[0] ?? ''` guards the index so a missing line fails the `assert.match` with a readable
message rather than a TypeError. All three await every `tick()` before `stop()`, so nothing is
left in flight. Correct.

Verdict per test: all correct - each has at least one assertion that fails if the behaviour under
test is removed, and none of them assert on a stub's own return value.

## Bugs found

1. `L227`: the fixture's bare `origin` repo is created outside the `mkdtemp` directory
   (`join(repo, '..', 'origin-<run>-<suffix>.git')`), and every `finally` block only removes
   `repo`. Scenario: running this test file leaves three `origin-run1-*.git` directories in the
   OS temp dir, permanently, once per run - a growing pile of bare repos on any machine that runs
   the suite regularly. Contradicts the fixture's own cleanup intent (`rm(repo, {recursive:true,
   force:true})` in `finally`). Severity: minor. Confidence: high. Fix sketch: return the origin
   path from `repoWithAgentWork` and `rm` it alongside `repo` in each `finally` (or put both under
   one `mkdtemp` parent and remove that).
