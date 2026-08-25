# Bug analysis: packages/framework/src/worktrees.ts

## Business logic (high-level)

The one implementation behind every surface that lists, removes, deletes or prunes an agent's
checkout: the CLI, the dashboard's Remove/Delete buttons, and the daemon's sweep.

### The removal rule

`removeProjectWorktree` enforces a single invariant: **only what is on the remote may go.** The
work is committed to the session's branch, the branch is pushed, and the checkout is removed only
once the remote has it — so no local deletion is ever the last copy of anything, and the single
failure mode ("the push did not land") is legible.

Four carve-outs sit in front of that rule, in a strictly ordered `if / else if` chain, and the
order is load-bearing:

1. **Web run covered by its anchor** (#1601) — `target === 'web'` + a recorded `cloudAnchor` + a
   clean tree + the branch tip being an ancestor of the anchor. Removed without a push, because the
   hand-off already pushed everything the cloud session clones at and the work lands on the
   session's own remote branch. Anything short of that proof falls through.
2. **A run branch holding nothing** (#1650) — a framework-minted branch (`isRunBranch`), a clean
   tree, and a tip contained in some remote-tracking ref *other than the branch's own*. Removed and
   the branch deleted, unpushed.
3. **A publish-nothing session** (`handoff.push === false`, B5/#1379) — kept unless it is already
   clean *and* pushed. Crucially nothing is committed on the way to that refusal: a kept checkout is
   a place someone works.
4. **The ordinary rule** — commit pending work, push if needed, then remove.

Guards before any of that: `isSafeAgentId` (rejects `../etc/passwd`), the worktree must be in the
listed set, the agent must not be running, the directory must be a real worktree root (#1654 — a
`branches/` directory git does not know as a worktree makes every command act on the *user's*
checkout), and the checkout must be on a branch. The meta read distinguishes absent (boot death →
recoverable default) from unreadable (→ refuse), which is the "unreadable is not publish freely"
rule.

After removal, branch deletion is decided from reads taken *before* anything was deleted
(`branchContains` at L246 runs before the two `deleteBranch` calls), so the containment answer
cannot be corrupted by the deletions it authorizes.

### The delete-session rule

`deleteProjectAgent` is the destructive-of-history sibling: it force-removes the checkout
(discarding uncommitted work, deliberately) and removes the archived meta + event log, but never
the branch. Records on the data branch are removed inside a `withDataBranch` cycle so the deletion
is itself a committed, pushed change; records outside it are plain unlinks.

### Concurrency / ordering

All git work is sequential per call. `listProjectWorktrees` reads three sources in parallel and
tolerates each failing independently. The sort is descending by `agentId`, which is the correct
"newest first" ordering because ids are `agentIdFromStartedAt` timestamps
(`YYYY-MM-DDTHH-mm-ss-SSSZ`) and therefore sort lexicographically by time.

## Functions (low-level)

### `listProjectWorktrees(cwd, opts)` (L87)

Joins worktree directory names with live and archived metas (live preferred). `live` is
`meta?.status === 'running'`. Sizing is skipped for a live tree (the number would be stale before
it printed) and when the caller passes `sizes: false` (the dashboard's list —
`dashboard-rpc/reads.ts` L130). Every source read is `.catch(() => [])`, so one broken source
degrades the row rather than failing the list. `sizeOf` swallows `worktreeSize` failures and omits
the field. The sizing await is inside the loop, so it is sequential — `pruneProjectWorktrees` pays
for a `du` per row it is about to delete, which is wasteful but not incorrect. Verdict: correct.

### `removeProjectWorktree(cwd, agentId, opts)` (L140)

Walked the whole chain against the tests:

- `isSafeAgentId` is `/^[A-Za-z0-9_-]+$/`, so no path separator or `.` can reach `worktreePath`.
- The running-agent refusal reads only live metas; an archived `running` status cannot block.
- `isWorktreeRoot(path)` is checked **before** `currentBranch(path)` — this ordering is the whole
  of #1654, and the test at `worktrees.test.ts` L289 asserts the user's checkout is neither
  committed nor pushed in that case.
- `readMetaFor` → `readMetaStrict` returns `undefined` only for `ENOENT` and rethrows everything
  else, including a `JSON.parse` failure. The catch turns that into a "record could not be read"
  refusal. Correct and pinned.
- Carve-out 1 evaluates `meta.cloudAnchor` before calling git, so a web run without an anchor falls
  through with no subprocess.
- Carve-out 2's `branchHoldsNothing` excludes the branch's *own* remote copy via
  `!name.endsWith('/' + branch)`, which is what stops every pushed run branch (the one with the PR)
  from reading as empty. `origin/HEAD` may also appear in the `--contains` output; it points at a
  branch that would have matched anyway, so it changes no answer. A remote-tracking ref that is
  merely stale answers `false`, and the caller falls back to the push — the safe direction.
- Carve-out 3 refuses *before* committing anything; the test asserts both the untouched working
  tree and that no commit was grabbed.
- The ordinary rule commits first (`commitPendingWork` uses `add -A`, so untracked files are
  included) and only then pushes. `worktreeClean` uses `git status --porcelain` without `-uno`, so
  untracked files count as dirty everywhere they are consulted — no path can force-remove a tree
  holding untracked work.
- Branch deletion: `deleteBranch` is `git branch -D` with `.catch(() => undefined)`, so a failed
  delete is silent and the branch is still pushed onto `branchesDeleted`. In practice the only way
  `-D` fails after the checkout is gone is the user having the same `tf-*` branch checked out in
  the main repo, so the mis-report is unreachable in normal use — recorded, not raised.
- Verdict: correct.

### `webCheckoutCovered(path, branch, anchor)` (L267)

Clean tree + `merge-base --is-ancestor branch anchor` inside the worktree. Any git failure (a
pruned anchor object, a moved tip) answers `false`. Verdict: correct.

### `branchHoldsNothing(cwd, path, branch)` (L284)

Described above. Note it is run in `cwd` while the cleanliness check is run in `path` — correct,
since worktrees share the repo's refs but not its index. Verdict: correct.

### `branchContains(cwd, outer, inner)` (L298)

`merge-base --is-ancestor refs/heads/<inner> refs/heads/<outer>`, false on any failure — including
`inner` not existing, which is the documented behaviour. Fully-qualified refs on both sides, so a
branch sharing a name with a tag cannot be misread. Verdict: correct.

### `readMetaFor` (L314) / `readMetaStrict` (L322)

The absent-vs-unreadable distinction, deliberately stricter than the store's forgiving list reads.
`archivedAgentPaths(...).find(p => p.endsWith('.json'))` picks the meta out of the meta+log pair.
Verdict: correct.

### `deleteProjectAgent(cwd, agentId, opts)` (L370)

Same id and liveness guards. The worktree is force-removed via `removeWorktree`, which swallows
every git failure — so a `branches/` directory that is no longer a worktree is simply left on disk
while the call still reports `ok: true`. That is a weaker contract than `removeProjectWorktree`'s
#1654 refusal, but the hazard #1654 was about (git commands running *inside* the residue directory)
does not exist here: `removeWorktree` runs in `cwd`, never in `path`.

Record removal splits on the data-branch prefix. Two notes: the non-data unlinks happen *before*
the funnel, so a funnel that fails whole leaves those already deleted (the row is gone either way,
which is the intent); and the funnel's op closes over paths computed before the sync, which is safe
because `withDataBranch` hands back the same `dataWorktreePath(cwd)` those paths were built from.
`removeFile` defaults to `rm(path, { force: true })`, so an already-absent file is fine — which is
what makes a half-deleted session finish cleanly. Verdict: correct.

### `pruneProjectWorktrees(cwd)` (L411)

Sequential per row; live rows are reported as skipped rather than attempted, and every refusal from
`removeProjectWorktree` becomes a skip with its own error text, so removed + skipped always equals
what the list showed. Verdict: correct.

## Observations that are not bugs

- A web run taking carve-out 1 keeps its **local** `tf-agent-*` branch: the chain short-circuits
  before carve-out 2, and `runBranchGoes` is false because the checkout's branch *is* the run
  branch. So local run branches accumulate for web runs the way #1650/#1657 stopped them
  accumulating for local runs. That is a cleanup gap rather than a defect against #1601, whose
  stated goal was keeping empty refs off `origin`.
- The ordinary rule will push a leftover checkout's branch even when that branch is the *user's*
  own (the `release` case in the test at L268 falls through to it). That is the rule working as
  written — recoverability first — not a bug.

## Bugs found

None found.
