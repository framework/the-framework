What the tests cover, against a real repository whose queue lives on the `agent-data` branch:

- **Order and sources** - `PLAN.md` is surfaced before the agent queue read off the `agent-data` branch, each with its contents as written.
- **Per-agent documents** - `PLAN_<name>.agent.md` and `TODO_<name>.agent.md` files at the workspace root are surfaced, a flat `PLAN.md` sorts before the scoped plan in its group, and an unrelated markdown file (`README.md`) is not surfaced.
- **One queue, one location** - the backlog is read off the `agent-data` branch and a stale `TODO_AGENTS.md` at the project root never shadows it.
- **Skips and failures** - a blank `PLAN.md` and an absent backlog surface nothing, and a workspace that does not exist reads as no documents rather than an error.
- **No traversal** - the flat names are bare file names without separators or `..`, and the scoped pattern admits only slugs (`PLAN_my-branch.agent.md`, `TODO_main-2.agent.md`), never a name carrying `..` or a path separator.
