# Bug analysis: packages/framework/src/merged-worktrees.ts

## Business logic (high-level)

The worktree sweep (#1036/E5). One rule replaces the old outcome-based retention policy: a
retained checkout may be reclaimed **only** once everything it holds is on the remote, so every
deletion is recoverable. This module owns three things and delegates the fourth:

1. **The per-project pass** (`removeMergedWorktrees`) - list retained checkouts, exclude the ones
   that are still someone's, answer "does this project even have a remote" once, then hand each
   candidate to `removeProjectWorktree` under the per-checkout agent lock.
2. **The wording** (`describeDeleted`) of the branches that went with a checkout.
3. **The loop over projects plus the announce-once accounting** (`startMergedWorktreeSweep`).
4. The *decision* itself lives in `worktrees.ts#removeProjectWorktree`, deliberately, so the
   automatic path and the dashboard's Remove button cannot disagree.

Invariants and lifecycle:

- **Nothing live, nothing busy.** `row.live` excludes a checkout whose agent is still going;
  `deps.busy` excludes one the daemon is still responsible for (spawning / running /
  mid-retirement). The SPEC's rationale is explicit: meta flips to `done` a beat before teardown
  archives, and a sweep landing in that window makes the archive recreate the directory it was
  reading from, silently un-doing the removal.
- **The lock is the second half of that.** `withAgentLock(worktreePath(cwd, agentId), ...)` keys on
  the same resolved checkout path teardown and the dashboard actions key on, so the removal is
  serialized with them rather than racing. `withAgentLock` queues (it never rejects on
  contention) and chains on *settlement*, so a failed predecessor does not poison the sweep.
- **No remote means keep everything, accounted for.** Asked once per project, not once per row: the
  answer cannot change inside one pass, and a per-row probe-and-push cycle against a repo with
  nowhere to push is pure waste. Every excluded row still gets a `failed` entry, so the announce
  layer can explain the pile-up.
- **Failure is never final.** A push that failed offline just succeeds on a later pass; that is
  the whole reason the sweep is recurring. Nothing in the failure path is persisted, so there is
  no "poisoned" state to clear.
- **Ordering/concurrency.** Rows are processed strictly sequentially (`for ... await`), so two
  removals in the same project never overlap; different projects are also sequential. Overlapping
  `tick()`s join the in-flight pass (`inflight ??=`) rather than being dropped, which is what makes
  `await tick()` mean "the sweep really finished" for the on-demand caller and the tests.
- **Error containment.** Three independent catches: the listing (`worktrees(cwd).catch(() => [])`),
  the project list (`opts.projects().catch(() => [])`) and each per-project sweep
  (`sweep(path).catch(() => empty)`). A bad project cannot stop the ones after it (pinned by a
  test). The one *uncaught* path is a throw out of `remove()` mid-loop - `removeProjectWorktree`
  wraps its body in try/catch and returns `{ok:false}` for everything reachable, so this is a
  reliance rather than a live defect, but if it ever threw, the remaining rows of that project
  would be silently skipped for the pass (self-healing next pass).
- **Announce-once accounting** lives in memory (`announced`), keyed by agent id, cleared on
  removal, lost on daemon restart - the SPEC wants exactly that, restart being the boot-time
  statement retained checkouts deserve.

## Functions (low-level)

### `removeMergedWorktrees(cwd, deps = {})`

In: project root and injectable seams. Out: `{ removed, failed }`.

- Defaults are resolved per call, so a test's partial `deps` still gets real behaviour for the
  rest. `worktrees` defaults to `listProjectWorktrees(path, { sizes: false })` - sizes off because
  `du` over every retained checkout is the expensive part and this caller never reads the number.
- Listing failure gives `[]` and therefore `{removed:[],failed:[]}` (a path that is not a repo
  sweeps nothing rather than throwing; pinned by a test).
- Filter: `!row.live && !deps.busy?.has(row.agentId)`. `busy` absent means `?.` yields `undefined`,
  i.e. nothing is busy, which the SPEC declares right for a caller that spawns no agents.
- Empty after filtering returns *before* `hasRemote`, so a no-op project costs one listing.
- `hasRemote` false gives one `failed` row per candidate with a fixed reason string; `remove` is
  never called (asserted by a test that also asserts `remoteChecks === 1`).
- Loop: each candidate through `withAgentLock`. `outcome.branchesDeleted` is only spread when
  truthy; `removeProjectWorktree` returns `deleted.length ? {branchesDeleted} : {}`, so an empty
  array - which *is* truthy and would print `its branches ` with nothing after it - is impossible
  by construction. Reliance noted, not a bug.
- Edge: a candidate whose directory disappears between listing and removal gets
  `no worktree for session <id>` from `removeProjectWorktree` and is reported as a *failure* even
  though the desired end state (no checkout) holds. Cosmetic at worst - the announce layer prints
  it once, and the row is gone from the next listing, so it cannot repeat.

Verdict: correct.

### `describeDeleted(branches)`

Pure wording. One branch gives `its branch x`; anything else gives `its branches` +
`join(' and ')`. Only ever called with a non-empty array (see above); three branches would read
`a and b and c`, which cannot occur - `removeProjectWorktree` pushes at most the checkout's branch
and the run-id branch. Verdict: correct.

### `startMergedWorktreeSweep(opts)`

- `sweep` default closes over `opts.busy` and calls it *per invocation*, i.e. once per project per
  pass, so the busy set is always fresh rather than snapshotted at construction. Correct, and
  load-bearing: a daemon that snapshotted at start-up would sweep a checkout that became busy later.
- `sweepAll` iterates projects, checking `stopped` at the top of each iteration, so `stop()` during
  a pass truncates it at the next project boundary but never mid-removal (which would be worse).
- Removal lines: `announced.delete(id)` first, so a checkout that reappears under the same id is
  accounted for afresh (pinned by a test). Two wordings - with branches vs. without - matching the
  SPEC's two cases.
- Retention lines: dedup on `(agentId -> last reason)`. Same reason is silent; a changed reason is
  printed and recorded. Both pinned by tests.
- `tick`: `stopped` gives a resolved no-op; otherwise `inflight ??= sweepAll().finally(clear)`. The
  `finally` runs after `sweepAll` settles, and `inflight` is only ever assigned here, so the clear
  cannot drop a *newer* pass. If `opts.log` threw, `inflight` would reject and every joined caller
  would see that rejection; `log` is the daemon's writer, so this is a reliance, not a live defect.
- `stop` is idempotent and only flips the flag; there is no timer to clear because the module
  deliberately has no clock of its own (E4 - the daemon's single tick drives it, including once at
  start-up).

Verdict: correct, with one keying question below.

## Bugs found

1. `L143`/`L158`: the announce-once map is keyed by **agent id alone**, not by project + agent id,
   while the sweep loops over every registered project with one shared map. Two projects holding a
   checkout with the same agent id would share one dedup slot: project B's keep reason is
   suppressed while it equals project A's last one, and two *differing* reasons would ping-pong
   (each pass re-announcing both, the noise the dedup exists to prevent). Agent ids are
   millisecond ISO timestamps (`agentIdFromStartedAt`), so a collision needs two agents started in
   the same millisecond in two projects - possible from one daemon tick, but rare. Contradicts the
   SPEC's "every retention is announced once per reason" being per checkout. Severity: minor.
   Confidence: low. Fix sketch: key on `project.path + ' ' + item.agentId` in both
   `announced.delete` and `announced.get`/`set`.
