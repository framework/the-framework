What the tests cover, against a real git repository:

- **Birth and seeding** - the sync births the `agent-data` branch checked out at `<root>/.branches/agent-data`, commits an empty `TODO_AGENTS.md` as "seed the queue", leaves the checkout clean, and reports "no remote" for a repository nothing can reach instead of throwing.
- **A second sync** - seeds nothing new, and a queue written and committed by hand since is left exactly as it is.
- **Converging with origin** - the branch reaches origin on the first sync, and an entry another clone pushes straight onto the branch is read on the next sync.
