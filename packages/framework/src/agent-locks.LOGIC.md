Serializes everything that changes one agent [1]'s checkout [2] inside the daemon: the daemon's own teardown of a finished agent, every action the user can fire at that agent (Push, "Open PR", Remove, Delete, Resume) and the sweep [3] that reclaims [4] checkouts all take one lock keyed by the checkout, run one at a time in arrival order, and never inherit each other's failures. The lock is in-process by design: the dashboard's actions are served inside the daemon and only the daemon writes to a project's checkouts, so there is no second process to coordinate with.

## Context

**User story**: the moment an agent ends, the user clicks Push, "Open PR", Remove or Resume on it. Whatever they clicked works, and the daemon's own wrap-up of the agent still completes.

**Problem**: an agent's status flips to done the moment its process writes it, a beat before the daemon's teardown archives its history, records the run [5] on the `agent-data` branch [6], pushes its branch and retires its checkout. Every action fired at that fresh "done" runs git against the same checkout as the teardown. Two of them at once make one fail on the ref, and a teardown that loses keeps a checkout it should have removed.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[3] sweep: a background job the daemon runs on its clock.
[4] reclaim: removing a finished agent's checkout once its work is on the remote.
[5] run: only the `logs` skill's record of one agent on the `agent-data` branch: a card (what was asked, the ticket, the branch, the pull request, how it ended, what it cost) and a diary (what the agent said).
[6] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks.
[7] archive: the transient copy of a finished agent's events and status under a project's `.the-framework/agents/`.

## Business logic — TL;DR

- **One lock per checkout, keyed by its resolved path** - every holder of the same checkout contends on one key however the path is spelled, and different checkouts never wait on each other.
- **Holders run one at a time, in arrival order** - a holder starts only once every earlier holder of the same checkout has finished, successfully or not.
- **A failure stays with its holder** - a holder that fails reports its own error to its caller, and the next holder still runs.

## Business logic

### One lock per checkout, keyed by its resolved path

#### Context

See `## Context`.

#### Business logic

The key is the checkout [2]'s path, resolved, so two spellings of one path are one key. The teardown and every action against an agent name the agent's checkout, so they contend on one key; an action against an agent whose checkout is already gone keys on the project root, where nothing contends. Different checkouts never wait on each other.

### Holders run one at a time, in arrival order

#### Context

**Business logic story**: who takes the lock: the teardown of a finished agent and the Resume that reuses or re-creates the agent's checkout (`daemon-runtime.ts`), Push, "Open PR", Remove and Delete (`dashboard-rpc/control.ts`), and the sweep [3] that reclaims merged checkouts (`merged-worktrees.ts`).

#### Business logic

A holder runs once every earlier holder of the same key has settled. Whoever runs first pushes, and the next finds the remote already has the branch; a Resume clicked off a fresh "done" waits the teardown out and then reads a settled archive [7]. The wait costs the click a beat and nothing else.

### A failure stays with its holder

#### Context

**Problem**: a teardown that fails must not skip the push waiting behind it, and one failed holder must not poison every later use of the same checkout.

#### Business logic

A waiter chains on its predecessor's completion, not on its success: it runs whether the predecessor succeeded or failed. Each caller gets its own outcome, or its own error, back untouched. Once the last holder of a key has settled, the key is released.
