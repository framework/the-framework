What the tests cover, against a real git repository:

- **Birth and layout** - the sync births the `agent-data` branch as an orphan whose only commit is "create the agent-data branch", checks it out at `<root>/.branches/agent-data` with the tickets under its `tickets/`, and leaves the checkout clean.
- **A repository with no remote** - the sync reports that it cannot converge, naming "no remote", instead of throwing.
- **The root link** - `tickets` at the repository root is a relative link to `.branches/agent-data/tickets`, absent from `git status`, while a real `tickets/` committed in the checkout still reaches the branch; a second sync links nothing new and writes nothing.
- **A pre-existing `tickets` path** - a file of the user's own at the root is left as is and stays visible to git, not excluded.
- **Converging with origin** - the branch reaches origin on the first sync, and a ticket pushed straight onto the branch from another machine is read on the next sync.
