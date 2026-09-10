What the tests cover:

- **The session name read off a branch** - a renamed agent branch yields its session name (`agent-add-comments` yields `add-comments`), a suffixed branch yields the suffixed name the agent was told it got (`agent-add-comments-2` yields `add-comments-2`), and a name that itself starts with `agent-` is a name like any other (`agent-agent-smith` yields `agent-smith`).
- **Branches that carry no session name** - the birth branch of the agent asking (`agent-<its own id>`), the user's own branches (`main`, `feat/mine`) and no branch at all yield no name; another agent's birth branch is still an agent branch and yields its id as a name.
- **Which branches are agent branches** - the birth branch and a renamed `agent-<name>` branch are; `main`, `data` and `agent-data` are not, the last because the `agent-data` branch carries the prefix without being any agent's.
- **Which ids are agent ids** - `data` is refused because `agent-data` is the `agent-data` branch; `data-2` is accepted.
