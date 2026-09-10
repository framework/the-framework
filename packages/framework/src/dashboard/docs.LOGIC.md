Decides which plan and backlog documents the dashboard's sidebar shows beside an agent [1], in which order, and what each contains: the project's flat `PLAN.md` then the per-agent `PLAN_<name>.agent.md` files, followed by the agent queue [2] (`TODO_AGENTS.md`, read off the `agent-data` branch [3] and never from a copy at the project root) then the per-agent `TODO_<name>.agent.md` files. Missing and blank documents are skipped, a runaway document is cut at about 200,000 characters with "… (truncated)" appended, and a workspace that cannot be listed or a document that cannot be read costs nothing but that document's absence.

## Context

**User story**: while an agent [1] works, the user reads its plan and its backlog in the sidebar without opening the checkout: the built-in system prompt has the agent write `PLAN_<name>.agent.md` (the plan for now) and `TODO_<name>.agent.md` (its backlog) at the workspace root, and the project's own `PLAN.md` and the agent queue [2] are the flat fallbacks.

## Glossary

[1] agent: The unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down.
[3] the `agent-data` branch: The branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks.

## Business logic — TL;DR

- **Two categories, in sidebar order** - the plan category then the backlog category, each as its flat document first and then its per-agent documents sorted by name.
- **The backlog comes off the `agent-data` branch** - the flat backlog is the agent queue as the `queue` skill reads it, so a stale `TODO_AGENTS.md` left at the project root never shadows it.
- **Skips and caps** - a missing or blank document is not shown, a document over about 200,000 characters is cut and marked "… (truncated)", and no read failure ever surfaces as an error.
- **Names are never user input** - every surfaced name is a workspace-root directory entry matched against a fixed name or a fixed slug pattern, so nothing can point outside the workspace.

## Business logic

### Two categories, in sidebar order

#### Context

See `## Context`.

#### Business logic

The plan category comes first: `PLAN.md` when present at the workspace root, then every root file named `PLAN_<name>.agent.md`, sorted by name. The backlog category follows: the agent queue [2], then every root file named `TODO_<name>.agent.md`, sorted by name. In both, `<name>` is a slug of lowercase letters, digits and dashes, the shape of an agent's [1] session name; any other markdown file at the root, such as `README.md`, is not surfaced.

### The backlog comes off the `agent-data` branch

#### Context

**Problem**: the agent queue [2] has one location, the `agent-data` branch [3]; a leftover copy at the project root would show a stale queue as the real one.

#### Business logic

The flat backlog is read the way the `queue` skill reads it, from `TODO_AGENTS.md` on the `agent-data` branch, and is surfaced under that name; a `TODO_AGENTS.md` at the workspace root is ignored entirely. When the project has no queue there, no backlog document is shown.

### Skips and caps

#### Context

**Problem**: the documents travel with every dashboard read of the project, so one runaway file must not bloat it, and a half-written or empty file must not show as an empty panel.

#### Business logic

A document that is missing, unreadable, or blank (only whitespace) is left out. A document longer than about 200,000 characters is cut there and ends with "… (truncated)". A workspace that does not exist or cannot be listed yields no documents at all, never an error.

### Names are never user input

#### Context

**Problem**: the daemon reads files by name for the browser; a name taken from a request could traverse out of the workspace.

#### Business logic

The flat names are fixed bare file names, and the per-agent names are taken from the workspace root's own directory listing and admitted only when they match the fixed pattern, whose slug part cannot contain a path separator or `..`. There is no path to guard because no name ever comes from outside.
