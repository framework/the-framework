Derives what the dashboard shows about an agent [1]: the session name [3] a view built from the agent's record carries, and, from its event stream [2], the driver session [4] behind it (driver, checkout [5], session id and link, model). The driver session is a fold over the events, so the live agent view [6] and the replay of a finished agent show the identical summary.

## Context

**User story**: the session name a row labels an agent by, and the agent view's "open session" and "Resume" affordances, are read from these projections.

**Business logic story**: nothing here is state of its own; the session behind the agent is the latest leg's.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] event stream: everything an agent does, one event per line of the agent's diary — the file `<id>.jsonl` the tool that runs the agent writes under `.the-framework/` in the agent's checkout, copied onto the `agent-data` branch when the agent ends. Every surface (dashboard, terminal, replay) is a projection of it.
[3] session name: the name an agent gives its own work (`[a-z0-9-]+`); its branch is renamed to `agent-<session name>` and the dashboard labels the agent by it.
[4] driver session: the coding agent's own conversation for one agent, which the driver can resume by its session id.
[5] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[6] agent view: one agent's page.
[7] the Overview: the dashboard's cross-project page at `/`.
[8] open question: a question nobody has answered yet, as the dashboard lists them across projects.
[9] agent id: an agent's stable id, derived from the moment it started; it names the agent's checkout directory, its branch until the agent names it, and its run.
[10] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later.

## Business logic — TL;DR

- **The session name of a view built from the record** - a name is present only when the agent's branch carries one, so an unnamed agent has no name rather than an empty one.
- **The driver session behind the agent** - nothing before the session opening; then the driver, the checkout, the link and the model of the latest leg, plus the id and link of the latest session update.

## Business logic

### The session name of a view built from the record

#### Context

**Business logic story**: the Overview [7] and the list of open questions [8] build their rows from an agent's record (its branch and its agent id [9]) rather than from its event stream [2], and every such row must spell the name the same way.

#### Business logic

The name is derived from the branch by the `branches` skill's rule: an `agent-<name>` branch that is not the agent's birth branch (the one named by the agent id) yields `<name>`; any other branch, or no branch, yields no name. The field is present only when there is a name, so a view of an unnamed agent carries no name rather than an empty one.

### The driver session behind the agent

#### Context

**User story**: "open session" jumps into the coding agent's own session, and "Resume" reopens a finished agent's conversation, which needs the session id together with the directory the agent ran in.

#### Business logic

Nothing is known before the session opening event; a stream without one yields no driver session. The opening gives the driver [10], whether it is the fake demo driver, the checkout [5] the agent ran in, the session link when the opening had a literal one, and the model when one was recorded. Each session update then sets the session id and, when it carries one, the link, and keeps the rest. A continuation emits a new session opening, so the driver, the checkout and the model are the latest leg's: a leg that recorded no model clears the model rather than keeping the previous leg's. The checkout is taken from the event on purpose: a finished agent's checkout is removed, and the event is the only surviving record of where it lived.
