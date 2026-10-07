What the tests cover:

- **Kinds and order** - a running agent yields a "started" item and a finished one a "finished" item that carries its terminal status, so a stopped agent reads differently from a done one; items carry the agent's title and come newest first across projects.
- **One item per agent** - a project's running agent and its older finished agents each yield exactly one item.
- **The recent cap** - only a project's 20 most recent agents are considered.
- **Unreadable projects** - a project whose agents cannot be read contributes nothing and is not counted as read whole; a project with no agents at all is read whole, with an empty list.
- **Identity** - an agent's start and its finish carry distinct keys (`started:<project>:<agent>` and `finished:<project>:<agent>`).
