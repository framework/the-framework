# Bug analysis: packages/framework/src/branch-links.test.ts

## Business logic (high-level)

Pins the behaviors the test-SPEC lists: no link for a checkout on its birth branch; rename adds
the new link and drops the stale one in the same pass; reclaimed/detached/slash-named cases; only
framework-owned links are touched (user files and foreign symlinks stay, and nothing is created
over them); the repo-root `branches` shortcut is created once, relative, git-hidden with the
`/branches` + `!/branches/` pair, and never clobbers; a `branches/` directory that is *not* a
worktree gets no link — asserted against real git with the default seams, which is exactly where
the #1654 bug lived; and the daemon pass visits every project and does nothing once stopped.

The suite splits sensibly: pure-logic cases run on an in-memory `LinksFs` with injected
`worktrees`/`branchOf`, and the one regression whose defect was in the *default* seams
(`worktreeBranch`) runs against a real repo — so a reintroduced enclosing-repo branch read cannot
pass the fake-based tests unnoticed.

Do the tests verify what they claim?

- The memFs cases assert the *complete* resulting link map (`branchLinksOf` → `deepEqual`), not
  just presence — so an extra spurious link (e.g. a `main` link) fails, and so does a missed
  deletion. Sound.
- The ours-only test covers all three protections in one scenario: user file kept, foreign link
  kept, wanted link *not* created over the user file. The foreign target `/somewhere/else` fails
  `isWorktreeDirName`, and the user file fails `readlink` — the two independent guards each get a
  probe. Sound.
- The root-shortcut test asserts both the created case (relative target + exact exclude pair, in
  order) and the occupied case (nothing created, *no excludes added* — the subtle half: hiding a
  user's own `branches` entry from their git status would be harm). Sound.
- The real-git test builds a genuine worktree (`addWorktree`), renames its branch, plants a
  residue dir (`tf-agent-r2` with only `.the-framework/` inside), runs with default seams, and
  asserts the exact sorted listing — which would surface both a missing rename link and a
  spurious residue link. `realpath` on the tmpdir preempts the macOS `/var → /private/var`
  mismatch that `isWorktreeRoot` also handles. Cleanup in `finally`. Sound.
- The pass test checks project order and the stopped no-op. Sound.

## Functions (low-level)

- **`current(agentId)`** — entry at the #1580 path with the birth-branch dir name. Correct.
- **`memFs(opts)`** — links map + files set. `readdir` filters direct children of `dir` (both
  links and files), matching the real contract; `symlink` throws `EEXIST` when occupied (so the
  create-over-user guard is actually exercised — production swallows it via `.catch`, and the
  test asserts nothing was created, which the throw guarantees); `lexists` answers for both
  kinds; `unlink` deletes only links — a production unlink of a *file* would silently no-op here
  rather than fail, but the ours-only test already proves files are never unlinked via the
  readlink guard, so no assertion depends on that gap. Verdict: correct.
- **`branchLinksOf(links)`** — projects the map onto branch-dir-relative names, excluding the
  root link. Correct.
- **The six tests** — each analyzed above. Verdict: correct.

Coverage note (not a defect): the overlap rule of `startBranchLinksPass` ("overlapping calls join
the pass in flight") and the re-pointed-link case (`wanted.get(name) !== target` with both
defined) have no direct test; the latter is the same code path as the rename test's deletion
branch, so the risk is low.

## Bugs found

None found.
