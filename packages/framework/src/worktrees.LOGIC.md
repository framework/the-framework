Lists, removes and deletes the checkouts [1] that a project's agents [2] leave behind: one list of the retained checkouts [3] that every surface shows, one removal behind the dashboard's "Remove" button, and the deletion of an agent together with its record. The checkouts, and every removal, are the branches provider's [5] (#1774): it lists them, and its `remove` reclaims one by its own rule, only what is on the remote may go, or discards one on request. What this file adds is the agent's side: a checkout whose agent is still going is never removed, and the agent's record goes with a delete.

## Context

**User story**: the user sees on the dashboard which checkouts [1] are still on disk — an agent that failed, was stopped, or ended waiting on its question keeps its own — each with the branch its work landed on and how its agent [2] ended, and removes one to get the disk back. Nothing removed here is ever lost: it is on the remote first. Deleting an agent takes it out of the dashboard for good, which is why the surfaces that offer it confirm first.

**Problem**: a checkout whose agent is still working is where that agent works: a stop [7] is how an agent ends, not pulling the floor out from under it.

## Glossary

[1] checkout: an agent's own working copy of the project, where it works; the branches provider [5] says where it is and which branch it is on. The user's own working copy is "the project's checkout" or "the user's checkout".
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch. The Framework starts none itself: the tool the project's start hook names runs it, and the dashboard shows it from the files that tool keeps.
[3] retained checkout: a checkout still on disk after its agent ended.
[5] branches provider: the command, among the commands of a project's dependencies, that a package declares as answering for the project's checkouts, in its own package.json under `"framework": { "branches": "<command>" }` (the `branches` skill's package declares its `branches` command); it lists the checkouts, tells what a branch holds, pushes and opens a branch's pull request, lands one, and reclaims a checkout (`store/branches.ts`).
[7] stop: ending an agent before it finishes: the Stop button, a signal to the process the agent's card names.
[8] agent id: an agent's stable id, derived from the moment it started; it names the agent's card and diary, and its branch until the agent names it.
[15] run: only the record of one finished agent: a card (what was asked, the branch, the pull request, how it ended, what it cost) and a diary (what the agent said).
[16] runs provider: the command, among the commands of a project's dependencies, that a package declares as answering for the project's finished agents, and that removes a finished agent or sets its late facts (`store/runs.ts`).

## Business logic — TL;DR

- **The retained checkouts, newest first** - every checkout the branches provider lists, joined with its agent's record: the branch, how the agent ended, whether it is still in use, and its size on disk for a finished agent.
- **Removing one checkout** - refused for an unsafe id, a running agent, or a project with no branches provider; otherwise the provider's `remove` decides, pushing the branch first when the remote lacks it, and its refusal is answered in its own words.
- **Deleting an agent** - takes the agent out of the dashboard, its record included, discarding uncommitted work with the checkout through the provider's `remove --discard`; its branch and commits stay.

## Business logic

### The retained checkouts, newest first

#### Context

**User story**: a live agent's [2] checkout [1] is listed and flagged rather than hidden, because "what is this directory and why can I not remove it" is exactly the question the list answers.

#### Business logic

Every checkout the project's branches provider [5] lists is a row, named by its agent id [8]; a project with no provider has no rows. Each row is joined with the agent's record, the card in the checkout first, else the finished agent's from the runs provider [16]: the branch the agent's work landed on when the record has one, how the agent ended (`done`, `stopped`, `failed`, `waiting`) or `running` while it is still going, and whether it is live, which is exactly a status of `running`: in use, not retained. A finished agent's size on disk is what the provider's sized listing says, asked for unless the caller wants rows only, as the dashboard's list does; a live agent's size is never shown, since a number for a tree being written to is wrong by the time it prints, and a size the provider did not give is simply absent. Rows are ordered newest first by agent id, which is derived from the agent's start. A listing, record or archive that cannot be read contributes nothing rather than failing the list.

### Removing one checkout

#### Context

**Business logic story**: the dashboard's "Remove" button. The rule it hands the decision to is the branches provider's [5] `remove`: a clean tree whose tip the remote has, pushed here when the remote lacks it, and nothing committed on the agent's [2] behalf. The tool that runs an agent reclaims the agent's checkout [1] itself by that same rule when the agent ends; what is left for this button are the checkouts that rule kept, and those of agents that ended waiting.

#### Business logic

Before the provider is asked, in this order:

- An id that is not a safe agent id [8] is refused: "invalid session id: <id>".
- An agent whose card says it is still running is refused: "that session is still going; stop it before removing its worktree".
- A project none of whose packages provides its checkouts is refused: "no package of this project provides its checkouts".

The provider's `remove` then runs, with a push allowed. Its answer is the answer: success, with the branches that went with the checkout when any did; or its refusal, in its own words (an unknown agent, a directory it does not know as a checkout, a checkout on no branch, uncommitted work, a branch not on the remote). A failure past that is reported as the error with its own words.

### Deleting an agent

#### Context

**User story**: the user deletes an agent [2] from the dashboard after confirming, and its row is gone for good: the checkout [1], the card that listed it and the diary that replayed it. Removing a checkout, by contrast, keeps the agent's row and its history.

**Problem**: a branch may carry merged work or an open pull request, and deleting one is not a thing a dashboard action should do silently; delete means "remove from the dashboard", not "erase every trace".

#### Business logic

An id that is not a safe agent id [8] is refused before anything is touched: "invalid session id: <id>". An agent whose card says it is still running is refused: "that session is still going; stop it before deleting it". Otherwise, when the branches provider [5] lists a checkout [1] for the agent, the provider removes it with its uncommitted work discarded, since the agent is being thrown away, and a removal it refuses fails the delete with its reason. Then the record that put the row in the list goes: when the runs provider [16] lists the agent's run [15], it is asked to remove it, and a removal it refuses fails the delete with its reason; an agent with no run, and a project with no runs provider, have nothing more to delete, so an agent whose checkout was already removed still finishes cleanly. The agent's branch and its commits are left in place: they are git's, not the dashboard's.
