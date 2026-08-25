# Bug analysis: packages/framework/src/branch-links.ts

## Business logic (high-level)

Keeps `.the-framework/branches/` navigable by branch name (`branch-links.SPEC.md`): one symlink
per worktree whose *current* branch differs from its directory's (birth-branch) name, plus a
repo-root `branches` shortcut, reconciled — derived from disk each pass, never tracked.

SPEC claims verified:

- **Reconcile, don't track** — `wanted` is rebuilt every pass from `worktreeDirEntries` ×
  `branchOf`; missing links are created, and the framework's own stale links (symlink whose
  target `isWorktreeDirName`, no longer wanted or re-pointed) are unlinked. A detached worktree
  (`branchOf → undefined`) and a legacy slash-named branch get no link; a checkout still on its
  birth branch is skipped (`branch === basename(path)`). ✓
- **A directory that is not a checkout has no branch** — the default `branchOf` is
  `worktreeBranch`, which answers only for a worktree *root* (`isWorktreeRoot` compares
  realpaths), so a residue directory cannot inherit the enclosing repo's branch and mint a
  `main → tf-agent-…` link (#1654). ✓ (pinned by the real-git test.)
- **Touch only what is provably ours** — deletion requires `readlink` to answer (files/dirs are
  skipped) *and* the target to be a sibling checkout name; creation requires `lexists` false, and
  the `symlink` race is swallowed (`.catch`). A user's own symlink pointing at a literal
  `tf-agent-*` name is indistinguishable from ours and would be dropped — inherent to the
  "provably ours" heuristic the SPEC itself defines; noted, not a bug. Absolute or path-y foreign
  targets (`/somewhere/tf-agent-x`) fail `isWorktreeDirName` (starts-with check) and are safe. ✓
- **Root shortcut** — created once over nothing, relative
  (`.the-framework/branches`), `mkdir(linksDir)` first so the link cannot dangle, then the
  `/branches` + `!/branches/` exclude pair — only when the link was actually attempted (an
  occupied path adds no exclude, pinned by the test). Exclude failures are swallowed
  (`excludeFromGit` is best-effort presentation). ✓
- **The daemon's pass** — `startBranchLinksPass`: per-project loop with a `stopped` check
  between projects, overlapping `tick()`s join the in-flight pass (`inflight ??=`), errors
  swallowed per project, nothing logged. ✓

Failure modes considered: `worktrees()` rejecting yields `[]` → `wanted` empty → every framework
link is dropped for that pass and recreated next pass once the read recovers — self-healing and
harmless for presentation-only links (the SPEC's "reconcile" stance). Same for a transient
`branchOf` failure (that one link flaps). Two worktrees cannot want the same link name (git
forbids one branch checked out twice); a wanted name colliding with a *real checkout directory*
(branch named like another run's birth branch) is skipped by `lexists` and never clobbers.
Concurrency: the daemon serializes passes per process; a concurrent allocation's reconcile could
race a pass, but every mutation is create-if-absent / unlink-with-catch, so the worst case is a
one-pass-late link.

## Functions (low-level)

- **`nodeLinksFs()`** — readdir catches to `[]` (missing dir fine); `mkdir` recursive; `readlink`
  catches to `undefined` (missing or not-a-symlink both read as "not ours" — exactly the
  discrimination the pass needs); `lexists` via `lstat` so dangling links count as existing (a
  dangling foreign link is correctly not clobbered; a dangling *ours* is unlinked by the stale
  loop first when its target name is a checkout name). Verdict: correct.
- **`reconcileBranchLinks(cwd, deps)`** — three phases (want, drop, create) + root link, all
  per-call awaited sequentially so drop-before-create holds for a renamed link. `.catch` on every
  mutation keeps the "never throws" promise; the outer `worktrees(...).catch` and
  `branchOf(...).catch` close the remaining reject paths. One nuance: `fs.readdir(linksDir)`
  rejection is *not* caught here — but `nodeLinksFs.readdir` (and the test fs) never reject;
  an injected fs that rejects would break "never throws". Reliance on the seam's contract
  (documented on `LinksFs.readdir`), noted only. Verdict: correct.
- **`startBranchLinksPass(opts)`** — `tick` after `stop` resolves immediately; `inflight`
  cleared in `finally` so a failed pass does not wedge future ticks (passAll cannot reject —
  both awaits are caught — so `finally` is belt-and-braces). Verdict: correct.

## Bugs found

None found.
