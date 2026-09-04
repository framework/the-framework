Non-obvious decisions only, grouped by business-logic flow. Anything not listed is left
to the implementer's judgment. Flag conflicts instead of silently deviating.

## The package
- A **library, not a skill**: no `SKILL.md`, no command. Skills import it; they never import
  each other.
- Named for the `agent-data` branch, but no function hardcodes it: every one that touches a
  branch takes it as an argument.
- `.branches/<branch>` holds a project's persistent checkouts, one per branch: the agents' own
  (made by other packages) and the data branch's (made here). The directory name is exported.
  Dotted so a `*` glob skips it: each checkout is a full copy of the project, and a tool that
  descends into them does N times the work.
- Hidden through the common git dir's `info/exclude`, never a committed `.gitignore`: the
  library must not touch tracked files; a per-worktree `info/exclude` is never read, and one
  line there, written once, covers every checkout. Best-effort: the checkout stands even when the rule could
  not be written. Prune before adding: a hand-deleted checkout leaves a registration that fails
  the add.
- Every git call has a time budget: a listed read 10s, network and `worktree add` 120s,
  other writes 30s. `worktree` goes by its second word (`add` slow, `list` a read, the rest
  a write), `branch` by its flags (bare or a listing flag reads; `-D`, `-m` or a new name
  writes); an unlisted subcommand gets the write budget, so a write is never cut short at
  the read budget. A killed `push` may have half landed, so a git call that outruns its
  budget fails as a timeout, its own error kind, never as a plain failure. git's output
  buffer is 16 MB (a large checkout's file listing); an overrun is not a timeout.

## The branch
- A branch of the project's repository holds the agents' data (tickets, the queue) the way
  `gh-pages` holds a site; code branches hold only code. Every write that changes something
  pushes, and a pull runs on its own, so a machine that writes nothing still gets what the
  others pushed.
- One branch for all skills, each with its own folder or file. Not one per skill: every
  extra branch needs its own checkout and its own sync failure to report.
- Missing locally, it is adopted from origin's copy; existing nowhere, it is born as an
  orphan branch, so no code commit is ever in its history.
- The name is written once, in `names`, as `DATA_BRANCH`, and imported everywhere else.
  `names` is its own entry point with no node imports, so browser code can import it.
- A read works from anywhere in the repository, an agent's worktree included: the checkout
  is looked for beside the real `.git`. A file is looked for in that checkout when there is
  one, then on the local branch, then on origin's copy; a directory listing always comes off
  a ref. A read can ask for a fresh copy: fetch, then origin's ref instead of the checkout,
  for a reader whose checkout may trail. A one-shot command opens the branch once: one fetch
  when there is an origin, every read off origin's copy (the local branch when there is no
  `origin/<branch>`), because its own writes go straight to the remote and never move the
  local branch. A read never fails: a missing file, a missing branch and a git that could
  not run all read as absent.

## Flow: a write
Fetch what others pushed → make the change → commit → push.

- Two writers. A long-lived process (a daemon) writes in its own checkout,
  `.branches/<branch>`, one write at a time per branch of a repository, a lock in memory: two
  processes on one clone are not guarded. The pull is that same cycle with an empty change,
  behind the same lock. A command an agent runs writes in a throwaway worktree outside the
  project, at the remote's tip (parentless when origin has no such branch), pushes, and
  deletes it whether or not the push landed. It never touches the process's checkout: that
  checkout's next write commits everything it finds, and a failed write resets it, new
  files included. Both try the push twice; the command's write then throws with nothing
  left to retry, the process's never throws: its callers are background ticks.
- A write is a re-runnable function, not a finished commit: a lost race winds the attempt's
  commit back and runs the function again on the new files, so the change lands once. The
  message is the caller's: fixed, or a function run after the change, since a batch only
  knows what it did once done. Never a force push. After two failed pushes the process's
  write reports the failure and the commit stays local in its checkout; the next write or
  pull rebases it onto the remote and pushes it with the new one. When that rebase conflicts
  the checkout is reset to origin's tip: the remote wins, every unpushed commit is dropped
  unreported, only the current change runs again.
- An op is handed a directory and writes into it. `BranchFileFs` is the file seam an op can
  take instead of the disk, for tests (type and node implementation ship here, the op
  injects it); it creates parent directories: git keeps no empty directory, so a skill's
  folder vanishes with its last file and is absent on a new branch.
- The remote is always `origin`; a repository without one is remote-less whatever other
  remotes it has. Then the process's write commits locally and reports no error, a command's
  write refuses (an outcome, not a throw), and the pull reports an error: nothing to
  converge with.
