What the tests cover, against throwaway project directories:

- **Order and sources** - `PLAN.md` is surfaced first, then the per-agent `PLAN_<name>.agent.md` and `TODO_<name>.agent.md` files, each with its contents as written; an unrelated markdown file at the root is not surfaced.
- **The agent queue is not a document** - a `TODO_AGENTS.md` at the project's root is never surfaced, and the `TODO` category has no flat file.
- **Skips and failures** - a blank `PLAN.md` surfaces nothing, and a project root that does not exist reads as no documents rather than an error.
- **No traversal** - a flat name is a bare filename and a scoped pattern admits only lowercase letters, digits and dashes.
