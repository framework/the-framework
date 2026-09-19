Tests of the read side of a project's agents (`agent-store.ts`), against an in-memory file system and a runs provider held in memory (`test-runs.ts`).

Covered:
- The finished agents are what the provider lists, newest first, each card unfolded into the dashboard's record (the running tool's fields included); a project with no provider, or whose provider fails, has none; a "since" keeps only the agents started at or after it.
- A checkout's card is read as the agent, with its process id and host; the project's own checkout, a checkout with no card and a card that does not parse are no agent.
- A checkout's agent carries the branch the checkout is on now, a renamed one included, rather than the card's first name; a checkout on no branch, or whose git files cannot be read, keeps the card's branch.
- A read never ends an agent whose process is gone, and writes nothing.
- Every `agent-<id>` checkout is found, newest first, a waiting one too; other directories are skipped; a project that never had an agent has none.
- An agent with both a record and a checkout is listed once, as its checkout says; one agent is found by id the same way; an unknown id finds nothing; with no provider only the agents with a checkout are listed.
- An agent's events replay from the finished agent's diary, and from the newer diary in its checkout while it has one, a question and a waiting end included, a torn last line dropped; an unknown or unsafe id has no events, nor has a finished agent in a project with no provider.
- A finished agent's diary is every line the provider has, and nothing for an unknown agent, an unsafe id or a project with no provider.
- An agent id and the start time it was derived from convert both ways, and a foreign id converts to nothing.
