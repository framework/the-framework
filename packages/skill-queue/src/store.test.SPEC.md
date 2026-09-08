What the tests cover: bringing a caller's view of the branch up to date, against real git.

- **The first sync** - the branch is born, its persistent checkout is at `.branches/agent-data` on that branch, and the queue file is seeded and committed so the checkout is clean between cycles.
- **Idempotence** - a second sync seeds nothing new, and a queue written on the branch since is left as it is.
- **No remote** - a repository nothing can reach is reported as an error state, named as such.
- **Converging with origin** - a branch origin already has is adopted, and an entry another machine pushed is on disk after the next sync.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
