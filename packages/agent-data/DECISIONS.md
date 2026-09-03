Non-obvious decisions only, grouped by business-logic flow. Anything not listed is left
to the implementer's judgment. Flag conflicts instead of silently deviating.

## The package
- A **library, not a skill**. A skill is a `SKILL.md` an agent reads, plus a command it
  runs; this package has neither, because only code uses it. Skills never import each
  other's code; this library is what every skill imports.
- Package name = branch name: `@gemstack/agent-data` manages the `agent-data` branch, so it
  is called the same.
- `.branches/` holds every extra checkout of the project, each agent's and the data
  branch's, so this library owns the name. It starts with a dot so a `*` glob skips it:
  every checkout inside is a full copy of the project, and a type-checker or test runner
  that descends into N copies runs N times. Hidden through `.git/info/exclude`, never a
  committed `.gitignore`: the project's files are not the library's to change.
- Every git call has a time budget by subcommand: reads 10s, local writes 30s, network and
  `worktree add` 120s. A killed `push` may have half landed, so a timeout is reported as a
  timeout, never as a rejected push.

## The branch
- A branch of the project's repository holds the agents' data — tickets, the queue — like
  `gh-pages` holds a site; code branches hold only code. Pushed on every write, pulled
  before every write and on a timer, so every machine sees the same files.
- One branch for all skills, each with its own folder or file on it. Not one branch per
  skill: every extra branch would need its own checkout on disk and its own sync failure to
  report.
- A branch that does not exist yet is created as an orphan branch, empty and with no parent
  commit, so no code commit is ever in its history.
- The branch name is written once, here, as `DATA_BRANCH`; every other package imports it.
- Read from anywhere in the repository, no checkout needed: the process's checkout when
  there is one, else the local branch, else origin's copy. A command reads origin's copy
  after one fetch: a command's write moves the remote branch only, so the local branch may
  not have the command's own earlier writes.

## Flow: a write
Fetch what others pushed → make the change → commit → push. If the push is rejected
because someone pushed in between, start over on top of their changes.

- Two writers. A long-running process (a daemon, the one that starts agents) writes in its
  own checkout, `.branches/agent-data`, one write at a time. A command an agent runs writes
  in a temporary worktree at the remote's tip, pushes, and deletes the worktree; it never
  touches the process's checkout: that checkout's next write commits everything it finds
  there, and a failed write resets it, so a second writer's files would land in the wrong
  commit or be wiped. A command's write that cannot be pushed fails; nothing of it waits.
- A write is handed over as a small function ("add this line"), not as a finished
  commit, so starting over is just running it again on the new files. Never a force
  push. After two failed pushes the write reports the failure and the commit stays local
  in the process's checkout. The next write or pull rebases it onto what the remote has by
  then and pushes both; when the rebase conflicts, the local commit is dropped: the remote
  wins, only the current change runs again, and nobody is told.
- No remote: the process's write commits locally and reports no error; a command's write
  refuses; the timed pull reports an error, because a branch nobody can reach is not a
  mode this supports.
