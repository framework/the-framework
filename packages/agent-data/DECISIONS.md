Non-obvious decisions only, grouped by business-logic flow. Anything not listed is left
to the implementer's judgment. Flag conflicts instead of silently deviating.

## The package
- A **library, not a skill**: no `SKILL.md` and no command, because only code uses it.
  Skills import this library; they never import each other.
- Package name = branch name: `@gemstack/agent-data` is the library for the `agent-data`
  branch. The code takes the branch as an argument everywhere.
- `.branches/` holds every extra checkout of the project, each agent's and the data
  branch's; the directory name is exported from here, and this library creates the data
  branch's checkout in it. It starts with a dot so a `*` glob skips it: every checkout
  inside is a full copy of the project, and a type-checker or test runner that descends
  into N copies runs N times. Hidden through `info/exclude`, never a committed
  `.gitignore`: the project's tracked files are not the library's to change. The rule goes
  in the common git dir: git reads excludes only from there, and one line there covers
  every checkout.
- Every git call has a time budget by subcommand: a listed read 10s, network and
  `worktree add` 120s, everything else 30s; an unlisted subcommand pays the write budget
  rather than risk cutting a write short. A killed `push` may have half landed, so a
  timeout is reported as a timeout, never as a rejected push.

## The branch
- A branch of the project's repository holds the agents' data — tickets, the queue — like
  `gh-pages` holds a site; code branches hold only code. Pushed on every write, pulled
  before every write, and pullable on its own, so a machine that writes nothing still ends
  up with what the others pushed.
- One branch for all skills, each with its own folder or file on it. Not one branch per
  skill: every extra branch would need its own checkout on disk and its own sync failure to
  report.
- A branch that does not exist yet is created as an orphan branch, empty and with no parent
  commit, so no code commit is ever in its history.
- The branch name is written once, in `names`, as `DATA_BRANCH`; every other package
  imports it. `names` is its own entry point and has no node imports, so browser-side
  code can import it without the git code.
- Read from anywhere in the repository, no checkout needed: a file comes from the
  process's checkout when there is one, else the local branch, else origin's copy; a
  directory listing always comes off a ref. A read can ask for a fresh copy: fetch first,
  skip the checkout, prefer origin's, for a reader about to act on the files whose checkout
  may trail what others pushed. A one-shot command reads origin's copy after one fetch: its
  own writes go straight to the remote, so the local branch can trail what it just wrote.

## Flow: a write
Fetch what others pushed → make the change → commit → push.

- Two writers. A long-running process (a daemon, the one that starts agents) writes in its
  own checkout, `.branches/agent-data`, one write at a time; the pull takes its turn in the
  same queue, being that same cycle with an empty change. A command an agent runs writes
  in a temporary worktree at the remote's tip, pushes, and deletes the worktree; it never
  touches the process's checkout: that checkout's next write commits everything it finds
  there, and a failed write resets it, so a second writer's files would land in the wrong
  commit or be wiped. A command's write that cannot be pushed fails; nothing is left
  behind to retry.
  The process's write never throws, its callers being background ticks; the command's
  write throws git's error.
- A write is handed over as a small function ("add this line"), not as a finished
  commit, so starting over is just running it again on the new files. The lost attempt's
  commit is wound back first, so the change lands once and not twice. Never a force
  push. After two failed pushes the write reports the failure and the commit stays local
  in the process's checkout. The next write or pull rebases it onto what the remote has by
  then and pushes the stranded commit together with the new one; when the rebase
  conflicts, the local commit is dropped: the remote wins, only the current change runs
  again, and the dropped commit is never reported.
- A write creates its parent directories: git keeps no empty directory, so a skill's
  folder is gone with its last file and absent on a branch just born.
- The remote is always `origin`. No remote: the process's write commits locally and
  reports no error; a command's write refuses; the pull reports an error, having no remote
  to converge with.
