Reads the plan/backlog documents the dashboard surfaces in its sidebar (#319/#309): per-session `PLAN_<SESSION>.agent.md` / `TODO_<SESSION>.agent.md` files plus the flat `PLAN.md` and the flat backlog.

## TLDR

- `DOC_CATEGORIES` defines the two categories (PLAN, TODO/backlog) with their flat names and session-scoped regexes; the flat backlog defers to `findFlatTodo` (the #682 root `TODO_AGENTS.md`).
- `readDocs(cwd)` returns each surfaced doc's name + content in sidebar order (flat first, then scoped sorted); blank files skipped, files over 200KB truncated, read errors omit the doc, never throws.

## Facts

- All names come from a flat `readdir` of the workspace root matched against fixed patterns — never from user input — so there is no path traversal to guard.
- The scoped files are written per session by the framework's system prompt (#323/#326); SESSION is a git-branch slug.
- `collectQueue` (queue.ts) filters `readDocs` output by `TODO*` basename, so what this surfaces defines what the queue counts.
