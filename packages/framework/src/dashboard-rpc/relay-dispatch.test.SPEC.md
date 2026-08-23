What the tests cover: the set of calls another daemon may make about an agent running on this device is exactly the agent-scoped reads, steering actions and handoff actions — and explicitly excludes starting an agent, deleting an agent, removing a worktree and previewing, since a device runs its own guarded start and destroying history or checkouts is not something a relaying daemon may reach. Any other name is refused. A permitted call runs against this device's own project, with the calling daemon's project id discarded.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
