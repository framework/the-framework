What the tests cover, against a real git repository with a file the user edited and a new one, and with the agent's facts stood in for by the test:

- **The project read** - lists the project's files and marks the edited file modified and the new one untracked, both uncommitted.
- **Without an agent** - a diff is the project folder's uncommitted change, a file git does not report changed has no diff, contents come from the project folder, and a path leaving the repository yields nothing.
- **An agent's changes** - an agent with a checkout lists its checkout's changed files; an agent with no checkout, and an input with no agent, answer an empty list, never the project folder's own changes.
- **An unknown agent's tree** - an agent the dashboard does not know yet answers pending; an input with no agent answers gone.
