Lists, removes and deletes the checkouts [1] that a project's agents [2] leave under `.branches/`: one list of the retained checkouts [3] that every surface shows, one removal behind the dashboard's "Remove" button, and the deletion of an agent together with its record. The git side of a removal is the `branches` skill's [5] rule (`reclaim.ts` in that package): only what is on the remote may go. What this file adds is the agent's side: a checkout whose agent is still going is never removed, and every refusal is worded one way.

## Context

**User story**: the user sees on the dashboard which checkouts [1] are still on disk — an agent that failed, was stopped, or ended waiting on its question keeps its own — each with the branch its work landed on and how its agent [2] ended, and removes one to get the disk back. Nothing removed here is ever lost: it is on the remote first. Deleting an agent takes it out of the dashboard for good, which is why the surfaces that offer it confirm first.

**Problem**: a checkout whose agent is still working is where that agent works: a stop [7] is how an agent ends, not pulling the floor out from under it.

## Glossary

[1] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. The user's own working copy is "the project's checkout" or "the user's checkout".
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch. The Framework starts none itself: the tool the project's start hook names runs it, and the dashboard shows it from the files that tool keeps.
[3] retained checkout: a checkout still on disk after its agent ended.
[5] skill: one of the four capabilities an agent is taught — `branches`, `tickets`, `queue`, `logs` — each a package with the instructions the agent reads, a command run as `npx <skill>`, and an API the product calls.
[7] stop: ending an agent before it finishes: the Stop button, a signal to the process the agent's card names.
[8] agent id: an agent's stable id, derived from the moment it started; it names the agent's checkout directory, its branch until the agent names it, and its run.
[14] birth branch: the branch a checkout is created on, `agent-<agent id>`, which also names the checkout's directory; the agent's branch until the agent names its work.
[15] run: only the `logs` skill's record of one agent on the `agent-data` branch: a card (what was asked, the branch, the pull request, how it ended, what it cost) and a diary (what the agent said).
[16] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs.

## Business logic — TL;DR

- **The retained checkouts, newest first** - every directory under `.branches/`, joined with its agent's record: the branch, how the agent ended, whether it is still in use, and its size on disk for a finished agent.
- **Removing one checkout** - refused for an unsafe id, an unknown checkout or a running agent; otherwise the git rule decides, pushing the branch first when the remote lacks it.
- **How a refusal is worded** - one wording per reason.
- **Deleting an agent** - takes the agent out of the dashboard, its record included, discarding uncommitted work with the checkout; its branch and commits stay.

## Business logic

### The retained checkouts, newest first

#### Context

**User story**: a live agent's [2] checkout [1] is listed and flagged rather than hidden, because "what is this directory and why can I not remove it" is exactly the question the list answers.

#### Business logic

Every directory under the project's `.branches/` is a row, named by the agent id [8] that is also the directory's name (the listing is the `branches` skill's [5]). Each row is joined with the agent's record, the card in the checkout [1] first, else the recorded one on the `agent-data` branch [16]: the branch the agent's work landed on when the record has one, how the agent ended (`done`, `stopped`, `failed`, `waiting`) or `running` while it is still going, and whether it is live, which is exactly a status of `running`: in use, not retained. A finished agent's size on disk is measured unless the caller asks for rows only, as the dashboard's list does; a live agent's tree is never measured, since a number for a tree being written to is wrong by the time it prints, and a size that cannot be read is simply absent. Rows are ordered newest first by agent id, which is derived from the agent's start. A listing, record or archive that cannot be read contributes nothing rather than failing the list.

### Removing one checkout

#### Context

**Business logic story**: the dashboard's "Remove" button. The git rule it hands the decision to is described with the `branches` skill's [5] `reclaim.ts`: a clean tree whose tip the remote has, pushed here when the remote lacks it, and nothing committed on the agent's [2] behalf. The tool that runs an agent reclaims the agent's checkout [1] itself by that same rule when the agent ends; what is left for this button are the checkouts that rule kept, and those of agents that ended waiting.

#### Business logic

Before any git command runs, in this order:

- An id that is not a safe agent id [8] is refused: "invalid session id: <id>".
- An id with no directory under `.branches/` is refused: "no worktree for session <id>".
- An agent whose card says it is still running is refused: "that session is still going; stop it before removing its worktree".

The git rule then runs with a push allowed, with the birth branch [14], `agent-<agent id>`, so that a branch the agent branched away from goes with the checkout once the branch that stays contains it, and with the caller's hook, run once removal is decided and just before the checkout goes. Success reports the branches that went with the checkout, when any did. A git failure past the decision is reported as the error with git's own words.

### How a refusal is worded

#### Context

See `## Context`.

#### Business logic

Each of the git rule's refusals is said once, naming the agent [2]:

- A directory git does not know as a worktree: "session <id>'s directory is not a git worktree; left alone".
- A checkout [1] on no branch: "session <id> is on no branch; its worktree was kept".
- Uncommitted work: "session <id> has uncommitted work; its worktree was kept"; nothing is committed on the way to a removal.
- A branch not on the remote: "<branch> is not on the remote (<git's words, or "not pushed">); its worktree was kept".

### Deleting an agent

#### Context

**User story**: the user deletes an agent [2] from the dashboard after confirming, and its row is gone for good: the checkout [1], the card that listed it and the diary that replayed it. Removing a checkout, by contrast, keeps the agent's row and its history.

**Problem**: a branch may carry merged work or an open pull request, and deleting one is not a thing a dashboard action should do silently; delete means "remove from the dashboard", not "erase every trace".

#### Business logic

An id that is not a safe agent id [8] is refused before anything is touched: "invalid session id: <id>". An agent whose card says it is still running is refused: "that session is still going; stop it before deleting it". Otherwise, when a checkout [1] is on disk, the caller's hook runs first , then the worktree is force-removed, its uncommitted work discarded with it, since the agent is being thrown away, and git's records of worktrees whose directories are gone are pruned. Then the record that put the row in the list goes: when the agent's run [15] is on the `agent-data` branch [16], the `logs` skill [5] deletes its card and diary as one committed, pushed change, and only a deletion that could not even be committed fails the delete; an agent with no run there has nothing more to delete, so an agent whose checkout was already removed still finishes cleanly. The agent's branch, `agent-<agent id>` or the name the agent gave it, and its commits are left in place: they are git's, not the dashboard's.
