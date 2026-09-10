What the tests cover:

- **Which agents are offered** - only `web` agents that recorded a cloud session; `local` and `actions` agents, and a web agent whose task never reached a session, are not.
- **Status is not a filter** - a web agent whose status reads done is still offered, since every web agent reads done once its task is handed off.
- **The window** - a session whose agent started before the window is dropped; an unreadable start time is skipped rather than treated as now.
- **Order and count** - sessions come newest first, all of them, with no cap; a session listed by two agents is offered once.
- **Queued picks** - a session with a pick waiting is flagged as such, and is served even outside the window or with no agent at all, appended after the recent ones.
