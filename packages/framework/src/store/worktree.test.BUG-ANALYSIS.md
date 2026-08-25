# Bug analysis: packages/framework/src/store/worktree.test.ts

## Business logic (high-level)

Tests for the worktree lifecycle, checked against `worktree.test.SPEC.md` — every clause of the
test-SPEC is present, and the assertions were read for genuineness:

- **Placement/naming** — `worktreePath` under `.the-framework/branches/tf-agent-<id>`;
  `agentBranchName` from the id.
- **Creation** — exact git argv (`worktree add -b <branch> <path>`, base appended when given)
  recorded via a call-capturing fake `GitRunner`; unsafe id rejected *before* any git call
  (`git.calls.length === 0` — the assertion that actually pins the traversal guard).
- **Listing/parsing** — porcelain fixture with a main checkout, a linked worktree and a detached
  entry; `refs/heads/` stripped; detached entry carries no `branch`; empty output → `[]`;
  `--porcelain` flag pinned; failing git → `[]`.
- **Removal/pruning** — plain-first (no `--force` on success), forced fallback exercised by a git
  fake that fails non-force calls, already-gone path harmless, prune argv + tolerance.
- **Re-attach (#1650)** — against real git: a missing branch is recreated from HEAD and checked
  out (verified via `currentBranch`), `deleteBranch` verified by a rejecting `show-ref`, and a
  branch the main checkout has out still rejects (the it-exists-so-rethrow path).
- **Root detection (#1654)** — against real git: true for the main checkout and a linked worktree,
  false for a subdirectory, a residue dir under `branches/` (created with a nested
  `.the-framework` to mimic a torn-down checkout), and a dir outside any repo. The test also
  *demonstrates the bug being guarded against*: `currentBranch(residue)` equals the enclosing
  repo's branch while `worktreeBranch(residue)` is undefined — an assertion pair that documents
  intent unusually well.
- **Commit-before-delete (#786/#1376)** — staged+committed argv sequence with cwd pinned to the
  worktree; clean tree short-circuits; persistent failure → false (with tightened
  attempts/delay so the test is fast); transient index.lock failure → success on retry with
  exactly two commit attempts counted.
- **End-to-end (#786)** — real repo: add → dirty edit → commitPendingWork → removeWorktree; the
  edit survives on the branch (`git show branch:file`), and the checkout dir is gone.
- **Rename (#736)** — renames only while on the run-id branch; agent-self-branched case does only
  the read; failed rename and failing git both return false without throwing.
- **currentBranch** — branch, detached (`HEAD`), and non-repo cases.

Test-craft notes:

- All real-git tests `realpath` their tmpdir (macOS `/var` symlink) and configure a local
  user/email, then clean up in `finally` — no cross-test leakage, no dependence on global git
  config.
- `recordingGit` returns one canned stdout for *every* call; tests that need per-call behavior
  build bespoke runners — no accidental reliance on the canned value where it would be wrong
  (checked each: e.g. `renameAgentBranch` tests feed the branch read explicitly).
- The `parseWorktreeList` fixture uses the old `worktrees/` path spelling inside a *path string*
  only — cosmetic, parsing does not interpret it.
- `assert.rejects(() => stat(path))` proves directory removal; fine.

Coverage gaps (not defects in the tests themselves): `worktreeSize` is covered by the sibling
`worktree-size.test.ts`; `branchPushed`, `repoHasRemote` and `worktreeClean` have no direct tests
here — they are exercised through `worktrees.ts`'s suite (outside this batch), and the test-SPEC
for this file does not claim them.

## Functions (low-level)

- `recordingGit(stdout)` — GitRunner capturing `{args, cwd}` and returning fixed stdout. Correct
  for argv-pinning tests.
- `failingGit` — always-throwing runner for tolerance paths. Correct.
- Real-git test bodies — each creates an isolated repo, commits an initial file (so worktree add
  has a HEAD), and asserts on observable git state rather than on internals. Every promise is
  awaited; `assert.rejects`/`doesNotReject` receive functions, so no unhandled rejections.
- Individual `test(...)` cases — none is a tautology; each failure mode described above would
  flip a concrete assertion (argv mismatch, wrong boolean, missing/kept path, wrong branch
  content).

## Bugs found

None found.
