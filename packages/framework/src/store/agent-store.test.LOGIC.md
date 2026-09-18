Tests of the read side of a project's agents (`agent-store.ts`), against an in-memory file system.

Covered:
- The recorded agents are listed newest first, every person's, each card unfolded into the dashboard's record (the running tool's fields included); a project with no `agent-data` branch has none; a "since" keeps only the agents started at or after it.
- A checkout's card is read as the agent, with its process id and host; the project's own checkout, a checkout with no card and a card that does not parse are no agent.
- A read never ends an agent whose process is gone, and writes nothing.
- Every `agent-<id>` checkout is found, newest first, a waiting one too; other directories are skipped; a project that never had an agent has none.
- An agent with both a record and a checkout is listed once, as its checkout says; one agent is found by id the same way; an unknown id finds nothing.
- An agent's events replay from its recorded diary, and from the newer diary in its checkout while it has one, a question and a waiting end included, a torn last line dropped; an unknown or unsafe id has no events.
- The recorded card and diary paths are named for an agent on the branch, and none for one that is not there or for an unsafe id.
- An agent id and the start time it was derived from convert both ways, and a foreign id converts to nothing.
