Non-obvious decisions only, grouped by business-logic flow. Anything not listed is left
to the implementer's judgment. Flag conflicts instead of silently deviating.

## The package
- A **library, not a skill**: no `SKILL.md` and no command, because only code uses it.
  Skills import this library; they never import each other.
- Package name = branch name: `@gemstack/agent-data` is the library for the `agent-data`
  branch; the branch is a parameter of every function here, and `DATA_BRANCH` only the
  constant a caller passes in.
- `.branches/` holds the persistent checkouts of the project, the agents' and this one's;
  the directory name is exported from here, and this library checks out the branch it is
  given in it. It starts with a dot so a `*` glob skips it: every checkout inside is a
  full copy of the project, and a type-checker or test runner that descends into N copies
  runs N times. Hidden through `info/exclude`, never a committed `.gitignore`: the
  project's tracked files are not the library's to change, and a rule that cannot be
  written does not fail the checkout. The rule goes in the common git dir: a per-worktree
  `info/exclude` is never read, and one line in the common one covers every checkout. A
  checkout deleted by hand leaves git's registration behind: prune before adding, or the
  checkout can never be remade.
- Every git call has a time budget by subcommand: a read 10s, network and `worktree add`
  120s, everything else 30s. `worktree` goes by its second word (`add` slow, `list` a
  read, the rest a write) and `branch` by its flags (a listing flag reads; `-D`, `-m` or a
  new name writes); an unlisted subcommand pays the write budget rather than risk cutting
  a write short. A killed `push` may have half landed, so a timeout is reported as a
  timeout, never as a rejected push.

## The branch
- A branch of the project's repository holds the agents' data — tickets, the queue — like
  `gh-pages` holds a site; code branches hold only code. Pulled on demand as well, so a
  machine that writes nothing still ends up with what the others pushed.
- One branch for all skills, each with its own folder or file on it. Not one branch per
  skill: every extra branch would need its own checkout on disk and its own sync failure
  to report.
- A branch missing locally is adopted from origin's copy; one that exists nowhere is
  created as an orphan branch, empty and with no parent commit, so no code commit is ever
  in its history.
- The branch name is written once, in `names`, as `DATA_BRANCH`; every other package
  imports it. `names` is its own entry point and has no node imports, so browser-side code
  can import it without the git code.
- Read from anywhere in the repository, no checkout needed: a file comes from the
  persistent checkout under `.branches/` when there is one, else the local branch, else
  origin's copy; a directory listing always comes off a ref. A read can ask for a fresh
  copy: fetch, then read origin's ref instead of the checkout, for a reader whose checkout
  may trail what others pushed. A one-shot command opens the branch once: one fetch, then
  every read off that one ref (origin's copy, or the local branch when origin has none);
  it reads origin's copy because its own writes go straight to the remote and never move
  the local branch.

## Flow: a write
Fetch what others pushed → make the change → commit → push.

- Two writers. A long-running process (a daemon) writes in its own checkout,
  `.branches/agent-data`, one write at a time; the pull takes its turn in the same queue:
  it is that same cycle with an empty change. A command an agent runs writes in a
  throwaway worktree outside the project, at the remote's tip, pushes, and deletes it
  whether or not the push landed; it never touches the process's checkout: that checkout's
  next write commits everything it finds there, and a failed write resets it, so a second
  writer's files would land in the wrong commit or be wiped. A command's write races at
  the push like the process's, twice in all; a push that still fails throws, and nothing
  is left behind to retry. The process's write never throws: its callers are background
  ticks.
- A write is a re-runnable function, not a finished commit: a lost race just runs it again
  on the new files. The commit message is the caller's too: fixed, or a function run after
  the change, since a write that batches several edits only knows what it did once it is
  done. The lost attempt's commit is wound back first, so the change lands once and not
  twice. Never a force push. After two failed pushes the write reports the failure and the
  commit stays local in the process's checkout. The next write or pull rebases it onto
  what the remote has by then and pushes the stranded commit together with the new one;
  when the rebase conflicts, the local commit is dropped: the remote wins, only the
  current change runs again, and the dropped commit is never reported.
- The file helper an op is handed creates parent directories: git keeps no empty
  directory, so a skill's folder is gone with its last file and absent on a branch just
  born.
- The remote is always `origin`. No remote: the process's write commits locally and
  reports no error; a command's write refuses, as an outcome it returns, not as a throw;
  the pull reports an error: it has no remote to converge with.
