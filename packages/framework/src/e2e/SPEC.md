The end-to-end stories: whole-product flows exercised the way a user drives them, from registering a project through to reading a finished agent's archived row. Each story goes through the same requests the dashboard makes, against real git repos and real spawned agent processes, with the fake driver in the coding agent's seat — so an entire agent lifecycle runs offline, deterministically, with no coding-agent CLI installed and no model called.

## What the stories cover

- **Projects and settings** - registering a repo and what the dashboard then shows for it, unknown projects degrading quietly, settings written in the dashboard reaching the agents the daemon starts, and the quota panel and Auto PM sweep controls.
- **Agent lifecycle** - starting an agent, watching its live feed, several agents running side by side in their own checkouts, what a finished agent's row and archived replay say, and publishing a finished agent's branch.
- **Steering and gates** - everything the user does to a live agent: answering its gate, chatting with it, changing its handoff level mid-flight, stopping it, deleting it.
- **Tickets and the agent queue** - browsing the ticket backlog, queueing a ticket as confirmed work, a drain agent claiming the queue's next entry, and the boards showing which agent is implementing which ticket.

## Rationale

These stories are where the product's own claims are checked rather than any one part's: that the pieces the user actually touches — the dashboard's requests, the daemon's spawning and teardown, git worktrees and branches, the event log and the archive — hold together across a whole flow. Substituting the fake driver is what makes that affordable: the wrapped coding agent is a black box the framework only gates on outcomes, so a scripted stand-in exercises every framework behavior around it without cost, latency, or a model's non-determinism.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
