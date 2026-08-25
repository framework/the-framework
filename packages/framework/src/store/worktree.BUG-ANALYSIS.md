# Bug analysis: packages/framework/src/store/worktree.ts

## Business logic (high-level)

Git-worktree plumbing for per-agent checkouts, checked clause by clause against
`worktree.SPEC.md`:

- **One checkout per agent** — `worktreePath` nests under `.the-framework/branches/<branch name>`;
  `addWorktree`/`attachWorktree` validate `isSafeAgentId` *before* building the path, so no
  traversal out of `branches/` (spec: "path-safe before it is ever used"). Creation failures
  reject — an agent that cannot get its checkout must not run. Held.
- **New agent branches; continued agent re-attaches** — `attachWorktree` tries a plain
  `worktree add <path> <branch>` first (which also DWIMs a remote-only `origin/<branch>` — the
  reason the existence check comes *after* the attempt, per the comment), and only when the local
  branch provably does not exist recreates it with `-b` from HEAD (#1650: the only branches the
  framework deletes held nothing the remote lacks, so HEAD is where the work was). Anything else —
  branch checked out elsewhere — rethrows the original error. Held, with one corner noted below
  (multi-remote DWIM ambiguity) as suspicious-but-unproven.
- **A checkout's own directory, told apart from the repo around it** — `isWorktreeRoot` compares
  git's `--show-toplevel` with the directory itself, both `realpath`ed (macOS `/var → /private/var`)
  and answers false on any failure; `worktreeBranch` is the guarded read every `branches/` consumer
  is supposed to use (and worktrees.ts / branch-links.ts do). The *plain* `currentBranch` remains
  exported for non-`branches/` paths and is used by `renameAgentBranch`, which is safe there only
  because of its `=== from` guard (the rename proceeds only when the checkout is on the run-id
  branch, and even in the residue-dir worst case `git branch -m tf-agent-<id> tf-<name>` renames a
  framework-owned ref, not the user's). Held.
- **Teardown commits before it deletes** — `commitPendingWork`: status → add -A → commit, retried
  (default 3 attempts / 300 ms) for the index.lock race (#1376), returns false so the caller keeps
  the checkout; on a retry after a failed commit, the staged state still shows in porcelain, so
  the sequence converges. `worktreeClean` is the commit-free read and deliberately *throws* on git
  failure (spec: the caller keeps the checkout rather than guessing) — its callers (worktrees.ts)
  treat a throw as "keep". Held.
- **Nothing local is ever the last copy** — `branchPushed`: local ref, remote-tracking ref, then
  `merge-base --is-ancestor local remote` (remote may be ahead); any failure → false; no fetch, by
  design sound because the remote ref is written by the push being checked. `repoHasRemote` is the
  once-per-sweep guard. `deleteBranch` is `-D` + swallow, blessed by the spec because the caller
  proved the stronger fact. Held.
- **Removal idempotent, forcing announced** — `removeWorktree` plain first, then `--force` with a
  log line; both failures swallowed for already-gone/never-registered paths. Held.
- **Forgiving reads** — `listWorktrees`/`parseWorktreeList` (porcelain records; bare/locked
  attributes ignored; detached leaves `branch` absent), `pruneWorktrees`, `currentBranch`,
  `worktreeSize` (du -sk × 1024, 5 s timeout, undefined on anything). Held.

Cross-cutting: line 2 statically imports `realpath` from `node:fs/promises`, unlike the package's
dynamic-import convention — this module is not on the browser-safe graph (client.test.ts enforces
that graph and passes), so it is a convention wrinkle, not a defect.

## Functions (low-level)

- `worktreePath` — `join(repo, '.the-framework', 'branches', worktreeDirName(agentId))`; callers
  validate the id (both creators do; `removeProjectWorktree` in worktrees.ts also checks before
  calling). Correct.
- `addWorktree` — id guard, `worktree add -b <branch> <path> [base]`; git mkdirs the leaf. Rejects
  on failure. Correct.
- `attachWorktree` — see above. Edge cases traced: (a) branch exists locally → attach or rethrow;
  (b) remote-only → DWIM attach with upstream; (c) gone everywhere → `-b` from HEAD; (d) first
  attempt failed for a non-branch reason (path exists, dirty admin state) while the branch is also
  absent → the fallback fails on the same reason and rejects, as specced. Corner (e): the branch
  exists on *two* remotes → git refuses the DWIM as ambiguous, local show-ref says absent, and the
  fallback silently creates a fresh branch from HEAD where an attach of the remote branch was
  intended — for a continued cloud run (`claude/*` recorded branch) that would resume without the
  session's pushed commits. Requires a second remote carrying the same branch name, which this
  product never creates itself; recorded as suspicious-but-unproven, not reported as a bug.
- `listWorktrees` — porcelain + catch → `[]`. Correct.
- `parseWorktreeList` — splits records on blank lines (`/\n\s*\n/`), reads `worktree `/`HEAD `/
  `branch ` prefixes, strips `refs/heads/`, drops branch when `detached`. A bare-repo record
  (no HEAD line) yields `head: ''` — harmless for its consumers (path/branch matching). Correct.
- `commitPendingWork` — attempts ≥ 1 clamped; catch-all per attempt; sleeps only between
  attempts. Failure mode where `status` itself fails (not a repo) retries then false — right
  direction (keep). Correct.
- `removeWorktree` — plain → forced with console notice → silent. Correct.
- `deleteBranch` — `-D` + swallow. Correct (spec-blessed).
- `isWorktreeRoot` — toplevel === self via realpath; false on empty output or any throw. Note it
  answers *true* for a symlink to a real worktree root (realpath resolves both sides) — that is
  what lets a `tf-agent-*`-named rename link pass for a checkout (reported against
  agent-store.ts/branch-links.ts, not here: this function's answer — "the thing this path names is
  a worktree root" — is arguably right for a link). Correct in isolation.
- `worktreeBranch` — guarded read; undefined for non-roots. Correct.
- `currentBranch` — `rev-parse --abbrev-ref HEAD`, `'HEAD'` → detached → undefined; catch →
  undefined. Correct.
- `renameAgentBranch` — read-guard (`currentBranch === from`) then `branch -m from to`; false and
  never-throw on both the moved-off case and a failed rename (name taken / invalid slug — an
  invalid slug leaves the run-id branch, as documented). It does not itself prevent the rename
  target from colliding with the `tf-agent-*` checkout-dir namespace; that collision is the
  cross-file finding attributed to branch-links.ts in agent-store.BUG-ANALYSIS.md. Correct per its
  own contract.
- `pruneWorktrees` — prune + swallow. Correct.
- `nodeSizeRunner` — execFile `du -sk` with 5 s timeout; rejects on error (including du's exit 1
  when some subdir was unreadable, even though stdout may hold a usable total — reads as unknown,
  inside the spec's "best-effort"). Correct.
- `worktreeSize` — parseInt of first whitespace field × 1024; NaN/throw → undefined. Correct.
- `branchPushed` — described above; `--is-ancestor` non-zero exit throws → caught → false; equal
  tips short-circuit true. Correct.
- `worktreeClean` — porcelain emptiness; throws on git failure by design. Correct.
- `repoHasRemote` — `git remote` output non-empty; catch → false. Correct.

## Bugs found

None found. (Two items deliberately left out of the bug list: the multi-remote
`attachWorktree` fallback corner — not reachable with anything the framework itself sets up — and
the static `node:fs/promises` import, a convention deviation on a module outside the enforced
browser graph.)
