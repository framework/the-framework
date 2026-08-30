What the tests cover: bringing a caller's view of the branch up to date, against real git.

- **The first sync** - the branch is born, its persistent checkout is at `.branches/tickets` on that branch, the queue file is seeded and committed so the checkout is clean between cycles, and the paths reported are the checkout and its `tickets/` folder.
- **The root link** - `tickets` at the repository root points into the checkout by a relative path, so a moved repository keeps working; it is hidden from the project's git, so no sweeping "add everything" commits it onto a code branch; and the checkout's own `tickets/` folder still commits, which the pair of exclude rules exists to allow.
- **A path of the user's own** - a `tickets` file already at the root is left exactly as it is, and stays visible to git.
- **Idempotence** - a second sync seeds and links nothing new.
- **No remote** - a repository nothing can reach is reported as an error state, named as such.
- **Converging with origin** - a branch origin already has is adopted, and a ticket another machine pushed is on disk after the next sync.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
