Serializes everything that mutates one agent's checkout, so the daemon's teardown of a finished agent and a user-fired action against that same checkout never run git concurrently and corrupt each other.

## Business logic — TL;DR

- **One checkout, one action at a time** - actions against the same checkout run strictly in arrival order; actions against different checkouts never wait on each other.
- **A failure never skips the queue** - an action that fails does not cancel or reorder the actions waiting behind it, and every caller still gets its own outcome or failure back unchanged.

## Business logic

### One checkout, one action at a time

#### User story

An agent's status flips to done the moment the agent itself writes it — a beat before the daemon archives the agent's history, commits the bookkeeping to the agent branch, and retires the worktree. In that window the dashboard already shows the agent as finished, so the user can immediately fire Push, Open PR, Remove, Delete, or Resume against the very checkout the daemon is still committing in.

#### Business logic

Teardown and every user-fired action take the checkout's turn before touching it, so only one of them runs git in a given checkout at a time and the rest wait their turn in arrival order. Turns are keyed by the checkout, so agents in different worktrees never block one another. An action against an agent whose worktree is already gone takes its turn on the project root, where nothing contends.

#### Rationale

Without this, the loser of the race reported "could not commit the work this session left uncommitted", and a teardown that lost kept a worktree it should have removed. Both actors live in the same daemon process by design — the dashboard's calls are served in-process and only the daemon writes to the project checkout — so serializing inside that one process is the whole fix; there is no second process to coordinate with.

### A failure never skips the queue

#### User story

A user clicks Push right behind a teardown that fails. The push must still happen, and must still report its own result.

#### Business logic

A waiting action starts as soon as the action ahead of it has finished, whether that action succeeded or failed — one failed holder never poisons or cancels what is queued behind it. Each caller receives exactly its own action's outcome, or its own action's failure, never the neighbouring action's.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
