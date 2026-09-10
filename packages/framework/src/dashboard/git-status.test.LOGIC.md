What the tests cover:

- **Branch and tree** - the current branch is reported with a clean tree and no pull request; a tree with changes is flagged dirty and the linked pull request is included; a directory that is not a git repository yields no status at all.
- **A failing pull request lookup** - the row degrades to no pull request rather than failing.
- **An agent's own pull request** - read with the agent's start time, a predecessor's merged pull request on a reused pinned branch is not shown; the agent's own pull request is shown whether just merged or open; a failing history read degrades to no pull request and is not marked pending.
