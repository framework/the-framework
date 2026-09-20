Decides which `PLAN` and `TODO` documents the dashboard's sidebar shows beside an agent [1], in which order, and what each contains: the project's flat `PLAN.md` then the per-agent `PLAN_<name>.agent.md` files, followed by the per-agent `TODO_<name>.agent.md` files. The agent queue [2] is not a document: it is a project package's data, read through that package's command and shown on that package's own page and the Overview's AI Queue card, so a `TODO_AGENTS.md` at the project's root is never surfaced. Missing and blank documents are skipped, a runaway document is cut at about 200,000 characters with "… (truncated)" appended, and a project root that cannot be listed or a document that cannot be read costs nothing but that document's absence.

## Context

**User story**: while an agent [1] works, the user reads its plan and its own to-do list in the sidebar without opening the checkout [4]: an agent writes `PLAN_<name>.agent.md` (the plan for now) and `TODO_<name>.agent.md` (what it still intends to do) at the project's root when the project's own skills tell it to, as the built-in system prompt [5] once told every agent, and the project's own `PLAN.md` is the flat fallback for the plan. The agent queue [2] the user reads on the queue package's own page.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] the agent queue: every task agents will work next, in the order they will be taken, kept by a project package (the `queue` skill keeps it as `TODO_AGENTS.md` on the `agent-data` branch, in priority sections); the dashboard reads it through the command that package declares (`../store/queue.ts`).
[3] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs.
[4] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. The user's own working copy is the project's checkout.
[5] the built-in system prompt: the standing instructions The Framework used to start every agent with, back when it ran the agent itself. It is gone; the documents named here are the ones agents wrote under it, and the ones a project's own skills tell an agent to write.
[6] skill: one of the four capabilities an agent is taught — `branches`, `tickets`, `queue`, `logs` — each a package with the instructions the agent reads, a command run as `npx <skill>`, and an API the product calls.
[7] session name: the name an agent gives its own work (`[a-z0-9-]+`); its branch is renamed to `agent-<session name>` and the dashboard labels the agent by it.

## Business logic — TL;DR

- **Two categories, in sidebar order** - the `PLAN` category then the `TODO` category, each as its flat document first and then its per-agent documents sorted by name.
- **The agent queue is not a document** - the `TODO` category has no flat file: a `TODO_AGENTS.md` at the project's root is never surfaced, and the queue is read elsewhere, through its package's command.
- **Skips and caps** - a missing or blank document is not shown, a document over about 200,000 characters is cut and marked "… (truncated)", and no read failure ever surfaces as an error.
- **Names are never user input** - every surfaced name is a directory entry of the project's root matched against a fixed name or a fixed pattern, so nothing can point outside the project.

## Business logic

### Two categories, in sidebar order

#### Context

See `## Context`.

#### Business logic

The `PLAN` category comes first: `PLAN.md` when present at the project's root, then every root file named `PLAN_<name>.agent.md`, sorted by name. The `TODO` category follows: every root file named `TODO_<name>.agent.md`, sorted by name, and no flat file. In both, `<name>` is made of lowercase letters, digits and dashes only, the shape of an agent's [1] session name [7]; any other markdown file at the root, such as `README.md`, is not surfaced.

### The agent queue is not a document

#### Context

**Problem**: the agent queue [2] is kept by a project package, on the `agent-data` branch [3] for the `queue` skill [6]; a leftover copy at the project's root would show a stale queue as the real one, and reading the branch here would make the dashboard know the queue's file.

#### Business logic

The `TODO` category has no flat file. A `TODO_AGENTS.md` at the project's root is ignored entirely, and the queue itself is read only through its package's command (`../store/queue.ts`), for the Overview's AI Queue card and the queue package's own page; the sidebar's documents never include it.

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
