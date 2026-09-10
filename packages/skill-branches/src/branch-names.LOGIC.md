Fixes the names of everything this package mints in git, and the layout under the project's `.branches/` directory that those names imply: what an agent id [1] may look like, that every branch made for an agent [2] is named `agent-…`, which branches are the package's to rename or delete, and how an agent's session name [3] is read back off its branch. The rules depend on nothing but the names themselves, so the dashboard's browser code labels an agent by the same reading.

## Context

**User story**: the user starts an agent and sees a checkout [4] appear under `.branches/` and a branch `agent-<agent id>` in the repository; once the agent names its work, the dashboard labels the agent by that session name [3], which is nothing but its branch name minus `agent-`. The user's own branches are never touched, and the `agent-data` branch [5], whose checkout sits beside the agents' checkouts, is never mistaken for an agent's.

**Problem**: an agent id becomes a directory name under `.branches/`, so an id holding a path separator or `..` could name a directory outside `.branches/`. A branch name holding a `/` cannot be a directory name at all, and a cloud session [6] cannot be started on it.

## Glossary

[1] agent id: an agent's stable id, derived from the moment it started; it names the agent's checkout directory, its branch until the agent names it, and its run.
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[3] session name: the name an agent gives its own work (`[a-z0-9-]+`); its branch is renamed to `agent-<session name>` and the dashboard labels the agent by it.
[4] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[5] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks.
[6] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[7] birth branch: the branch a checkout is created on, `agent-<agent id>`, which also names the checkout's directory; the agent's branch until the agent names its work.
[8] agent branch: a branch whose name starts with `agent-`, other than `agent-data`: the branch a checkout is created on, or the `agent-<session name>` it is renamed to. The only branches this package renames or deletes.

## Business logic — TL;DR

- **A valid agent id** - letters, digits, `_` and `-` only, and never `data`.
- **Every minted branch is `agent-…`** - one slash-free prefix names every branch the package creates, which is what lets a checkout directory carry its branch's name.
- **The birth branch and the checkout directory share a name** - a checkout is created on the birth branch [7] `agent-<agent id>` in the directory `agent-<agent id>`, and the id is read back off the directory's name.
- **Which branches are the package's** - a branch is an agent branch [8] when it starts with `agent-` and is not `agent-data`; only those are ever renamed or deleted.
- **The session name is the branch name** - `agent-<session name>` minus the prefix, and no name while the branch is still the birth branch of the agent asking.

## Business logic

### A valid agent id

#### Context

See `## Context`.

#### Business logic

An agent id [1] is accepted when it has at least one character and consists only of ASCII letters, digits, underscores and hyphens. Path separators, dots and spaces are refused, so no id can name a directory outside `.branches/`. The id `data` is refused as well: its branch would be `agent-data`, the name of the `agent-data` branch [5], whose own checkout [4] sits at `.branches/agent-data` and would be indistinguishable from that agent's. Ids such as `data-2` are accepted.

### Every minted branch is `agent-…`

#### Context

See `## Context`.

#### Business logic

Every branch the package creates is named `agent-` followed by a slash-free name. The prefix holds no `/` on purpose: a `/` in a branch name is never accepted as the revision a cloud session [6] starts from, and its absence is what lets a checkout [4] directory be named exactly as its branch.

### The birth branch and the checkout directory share a name

#### Context

**Business logic story**: an agent's [2] id exists before its session name [3] does, so the branch is created from the id and renamed once the agent picks a name (the rename is in `worktree.ts`).

#### Business logic

A checkout [4] is created on its birth branch [7], `agent-<agent id>`, and the checkout's directory under `.branches/` carries the same name, so a listing of `.branches/` reads as a list of branch names. The agent id [1] is read back off a directory's name by dropping `agent-`.

### Which branches are the package's

#### Context

**Problem**: the package must never rename or delete a branch of the user's own, and it knows branches by name alone. `agent-data` carries the prefix without being any agent's.

#### Business logic

A branch is an agent branch [8] when its name starts with `agent-` and it is not `agent-data`. Only agent branches are ever renamed (when an agent [2] names its work) or deleted (when a checkout [4] is reclaimed). `main`, `data`, a feature branch and `agent-data` are not agent branches.

### The session name is the branch name

#### Context

**Business logic story**: a checkout [4] has one branch, and that branch is the name: the session name [3] is read off the branch and recorded nowhere else. The dashboard and the product's own bookkeeping read it this way.

#### Business logic

Given a branch and, when known, the id of the agent [2] whose checkout is on it:

- No branch, or a branch that is not an agent branch [8] (`main`, `feat/mine`), carries no session name [3].
- The birth branch [7] of that very agent, `agent-<its agent id>`, carries no session name: the agent has not named its work yet.
- Any other agent branch carries its name minus `agent-`: `agent-add-comments` names `add-comments`, and a suffixed branch names the suffixed name the agent was told it got (`agent-add-comments-2` names `add-comments-2`). A name that itself starts with `agent-` is a name like any other: `agent-agent-smith` names `agent-smith`.
- When no agent id is given there is no birth branch to rule out, so every agent branch reads as a session name. Another agent's birth branch reads as a name too: `agent-r2`, asked about for agent `r1`, names `r2`.
