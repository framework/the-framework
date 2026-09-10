Decides which `PLAN` and `TODO` documents the dashboard's sidebar shows beside an agent [1], in which order, and what each contains: the project's flat `PLAN.md` then the per-agent `PLAN_<name>.agent.md` files, followed by the agent queue [2] (`TODO_AGENTS.md`, read off the `agent-data` branch [3] and never from a copy at the project's root) then the per-agent `TODO_<name>.agent.md` files. Missing and blank documents are skipped, a runaway document is cut at about 200,000 characters with "… (truncated)" appended, and a project root that cannot be listed or a document that cannot be read costs nothing but that document's absence. The same read also feeds the per-project queue collection in `queue.ts`, which parses its `TODO` half.

## Context

**User story**: while an agent [1] works, the user reads its plan and its own to-do list in the sidebar without opening the checkout [4]: the built-in system prompt [5] has the agent write `PLAN_<name>.agent.md` (the plan for now) and `TODO_<name>.agent.md` (what it still intends to do) at the project's root, and the project's own `PLAN.md` and the agent queue [2] are the flat fallbacks.

## Glossary

[1] agent: The unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down.
[3] the `agent-data` branch: The branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks.
[4] checkout: An agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. The user's own working copy is the project's checkout.
[5] the built-in system prompt: The standing instructions every agent starts with (`prompts/system_prompt.md`).
[6] skill: One of the four capabilities an agent is taught — `branches`, `tickets`, `queue`, `logs` — each a package with the instructions the agent reads, a command on the agent's PATH, and an API the product calls.
[7] session name: The name an agent gives its own work (`[a-z0-9-]+`); its branch is renamed to `agent-<session name>` and the dashboard labels the agent by it.

## Business logic — TL;DR

- **Two categories, in sidebar order** - the `PLAN` category then the `TODO` category, each as its flat document first and then its per-agent documents sorted by name.
- **The flat `TODO` document is the agent queue, off the `agent-data` branch** - it is read the way the `queue` skill [6] reads it, so a stale `TODO_AGENTS.md` left at the project's root never shadows it.
- **Skips and caps** - a missing or blank document is not shown, a document over about 200,000 characters is cut and marked "… (truncated)", and no read failure ever surfaces as an error.
- **Names are never user input** - every surfaced name is a directory entry of the project's root matched against a fixed name or a fixed pattern, so nothing can point outside the project.

## Business logic

### Two categories, in sidebar order

#### Context

See `## Context`.

#### Business logic

The `PLAN` category comes first: `PLAN.md` when present at the project's root, then every root file named `PLAN_<name>.agent.md`, sorted by name. The `TODO` category follows: the agent queue [2], then every root file named `TODO_<name>.agent.md`, sorted by name. In both, `<name>` is made of lowercase letters, digits and dashes only, the shape of an agent's [1] session name [7]; any other markdown file at the root, such as `README.md`, is not surfaced.

### The flat `TODO` document is the agent queue, off the `agent-data` branch

#### Context

**Problem**: the agent queue [2] lives in one place, the `agent-data` branch [3]; a leftover copy at the project's root would show a stale queue as the real one.

#### Business logic

The flat `TODO` document is the agent queue as the `queue` skill [6] reads it, from `TODO_AGENTS.md` on the `agent-data` branch, surfaced under that name; a `TODO_AGENTS.md` at the project's root is ignored entirely. When the project has no queue on that branch, no such document is shown.

### Skips and caps

#### Context

**Problem**: the documents travel with every dashboard read of the project, so one runaway file must not bloat it, and a half-written or empty file must not show as an empty panel.

#### Business logic

A document that is missing, unreadable, or blank (only whitespace) is left out. A document longer than about 200,000 characters is cut there and ends with "… (truncated)". A project root that does not exist or cannot be listed yields no documents at all, never an error.

### Names are never user input

#### Context

**Problem**: the daemon reads files by name for the browser; a name taken from a request could traverse out of the project.

#### Business logic

The flat names are fixed bare file names, and the per-agent names are taken from the project root's own directory listing and admitted only when they match the fixed pattern, whose `<name>` part cannot contain a path separator or `..`. There is no path to guard because no name ever comes from outside.
