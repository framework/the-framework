# Bug analysis: packages/framework/src/worktrees.test.ts

## Business logic (high-level)

Eighteen tests exercising `removeProjectWorktree` and `deleteProjectAgent` **against real git**,
deliberately: as the header comment says, "was the diff actually destroyed" is not a question a fake
answers. Every fixture builds a real repo with a real bare `origin.git` beside it, adds a real
linked worktree via the store's own `addWorktree`, and leaves an uncommitted edit in it — the exact
shape a failed agent leaves behind.

Two fixture details that make the suite trustworthy:

- `realpath(await mkdtemp(...))` — on macOS `/var` is a symlink to `/private/var`, and git reports
  the resolved path. Without this, `isWorktreeRoot`'s "is git's top level this very directory"
  comparison would fail spuriously.
- The bare `origin.git` lives *inside* the repo directory, so the `finally { rm(repo, recursive) }`
  cleans up the remote too. It is a real remote, so "did the work reach the remote" is answered by
  `git show refs/remotes/origin/<branch>:index.html` rather than by a mock's call log.

Every test wraps its assertions in `try/finally` with a recursive `rm`, and every assertion is
awaited. `assert.rejects(() => stat(path))` is used for "this is gone", which is a real assertion
(it fails if the path still exists).

What the suite pins, mapped to the module's rule:

- **The rule itself** — the uncommitted edit ends up on the branch *and* on the remote before the
  checkout goes (L40); no remote → kept with "not on the remote" (L61); a commit that cannot be
  made (a refusing `pre-commit` hook, which is the reproducible stand-in for "no git identity") →
  kept with "uncommitted work" and the edit still readable in the tree (L385).
- **Carve-out 3 (publish-nothing)** — kept even though the push *would* have worked, with three
  separate assertions that nothing was published, nothing was committed, and the branch log still
  reads `init` (L75); the unreadable-meta refusal (L104); and the "already pushed by hand" case
  that lets it go (L126).
- **Carve-out 1 (web)** — the anchor case removes without pushing an empty ref (L150), and the
  dirty-tree case falls back to the ordinary rule and does push (L180). The pair isolates the
  proof condition.
- **Carve-out 2 (empty run branch)** — goes with its branch, unpushed (L204); a commit origin has
  never seen is *not* covered and gets the ordinary rule (L229); a branch pushed under its own name
  contains its own tip and must stay (L249) — that last one is the test that pins the
  `!name.endsWith('/' + branch)` filter, without which every pushed run branch would be deleted
  after each run.
- **Branch ownership** — a checkout on a branch the framework did not mint (`release`) keeps that
  branch while the run-id branch it was cut from goes (L268); the comment records the real-world
  case (a checkout found on `main`) and the key insight that git's refusal to delete a checked-out
  branch must not be the guard.
- **#1654** — a `branches/` directory that is no longer a worktree is refused, with four assertions
  proving the *user's* checkout was not committed, its edit not swallowed, nothing pushed, and the
  directory left in place. This is the strongest test in the file: without the guard, the ordinary
  rule would have operated on the enclosing repo.
- **#1657 run-id branch** — deleted when the kept branch contains it (L316); kept when it carries a
  commit the kept branch lacks (L360). The second fixture is careful to branch from the recorded
  init sha rather than from `main`, with a comment explaining that CI's `git init` names the branch
  `master` — a real portability trap avoided.
- **#1650+#1657 together** — a commitless triage leaves neither branch, asserted by
  `git branch --list tf-*` being empty (L338).
- **Delete** — records and worktree gone but the branch kept (L432); uncommitted work discarded
  rather than committed, asserted both ways with `match`/`doesNotMatch` (L452); a record-only
  session with no worktree still clears (L468); an invalid id refused before anything is touched
  (L480).

The `branchesDeleted` assertions are exact `deepEqual`s including array order
(`['tf-triage-quick', runBranch]`), which pins the emptyBranch-then-runBranch ordering in the
implementation.

## Functions (low-level)

### `repoWithDirtyWorktree(opts)` (L21)

The shared fixture. `opts.remote !== false` means a remote is created by default and the one
no-remote test opts out — a slightly unusual polarity, but correct and used consistently. Returns
`{repo, path, branch}` so tests can address all three. Correct.

### `archiveAgent(repo, id)` (L422)

Writes the two files that put a row in the rail (`<id>.json` + `<id>.jsonl`) under
`.the-framework/agents/`, and returns their paths so the delete tests can assert on them
individually. The L432 test additionally asserts via `listAgents` both before and after, so it
proves the row-level effect and not just the file-level one. Correct.

### Per-test notes

- L40 / L61 / L385: the three ordinary-rule outcomes. Each asserts the *content* of the surviving
  work, not just a boolean.
- L104: writes literal `not json` as the meta — exercises `readMetaStrict`'s rethrow path, which is
  the only way to reach the "could not be read" refusal.
- L150 / L204 / L268 / L338: all write `.git/info/exclude` with `.the-framework/` first, because
  otherwise the framework's own bookkeeping file in the worktree would make `worktreeClean` false
  and defeat the carve-out being tested. That is a real detail of how installs configure a repo
  (#1600) and the tests model it rather than working around it.
- L289: leaves the *user's* checkout dirty on purpose and records `HEAD` before the call, so the
  "nothing was committed on the user's checkout" assertion compares against a captured baseline
  rather than a guess.
- L480: passes `/nowhere` as the cwd, proving the id check happens before any filesystem access.

## Coverage gaps (not bugs)

- Nothing covers a *live* agent's checkout being refused (`'that session is still going'`) — the
  fixture never writes a `running` live meta.
- Nothing covers `pruneProjectWorktrees` or `listProjectWorktrees` at all; both are exercised only
  indirectly through the CLI's own tests.
- Nothing covers `deleteProjectAgent`'s data-branch funnel branch (a record filed on `tf-data`);
  only the transient-copy path is tested.
- The `opts.beforeRemove` seam is never exercised in either function.

## Bugs found

None found.
