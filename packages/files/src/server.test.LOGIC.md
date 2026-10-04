What the tests cover, against a real git repository with a file the user edited and a new one, and with the agent's facts stood in for by the test:

- **The project read** - lists the project's files and marks the edited file modified and the new one untracked, both uncommitted.
- **Without an agent** - a diff is the project folder's uncommitted change, a file git does not report changed has no diff, contents come from the project folder, and a path leaving the repository yields nothing.
- **An agent's changes** - an agent with a checkout lists its checkout's changed files; an agent with no checkout, and an input with no agent, answer an empty list, never the project folder's own changes.
- **An unknown agent's tree** - an agent the dashboard does not know yet answers starting; an input with no agent answers gone.
- **An agent's commits** - an agent with one commit in its checkout: `commits` lists that commit with its subject, and an input with no agent lists none; `commit` answers what the commit changed (its file, added), and nothing for a commit of the project that is not the agent's or for an input with no agent; `diff` with the commit answers that file's diff in it, and nothing for a file the commit did not change. The diff of a file in the first commit stays that commit's own once a later commit changes the file again.
