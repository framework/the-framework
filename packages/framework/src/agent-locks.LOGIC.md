Serializes the dashboard's own actions against one finished agent [1]'s checkout [2] inside the daemon: "Open PR", Remove and Delete all take one lock keyed by the checkout, run one at a time in arrival order, and never inherit each other's failures. The lock is in-process by design: the dashboard's actions are served inside the daemon. It does not coordinate with the tool that runs the agent, which is another process and reclaims [4] the checkout itself when the agent ends: the dashboard offers these actions only once the agent has ended, and that tool's reclaim refuses a checkout it cannot take cleanly.

## Context

**User story**: the moment an agent ends, the user clicks "Open PR", then Remove or Delete on it. Whatever they clicked works.

**Problem**: each of these actions runs git against the same checkout [2]. Two of them at once make one fail on the ref, and a removal that loses keeps a checkout it should have removed.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[4] reclaim: removing a finished agent's checkout once its work is on the remote.

## Business logic — TL;DR

- **One lock per checkout, keyed by its resolved path** - every holder of the same checkout contends on one key however the path is spelled, and different checkouts never wait on each other.
- **Holders run one at a time, in arrival order** - a holder starts only once every earlier holder of the same checkout has finished, successfully or not.
- **A failure stays with its holder** - a holder that fails reports its own error to its caller, and the next holder still runs.

## Business logic

### One lock per checkout, keyed by its resolved path

#### Context

See `## Context`.

#### Business logic

The key is the checkout [2]'s path, resolved, so two spellings of one path are one key. Every action against an agent names the agent's checkout, so they contend on one key; an action against an agent whose checkout is already gone keys on the project root, where nothing contends. Different checkouts never wait on each other.

### Holders run one at a time, in arrival order

#### Context

**Business logic story**: who takes the lock: "Open PR", Remove and Delete (`dashboard-rpc/control.ts`).

#### Business logic

A holder runs once every earlier holder of the same key has settled. Whoever runs first pushes, and the next finds the remote already has the branch; a second action clicked off a fresh "done" waits the first out and then finds the state the first one left. The wait costs the click a beat and nothing else.

### A failure stays with its holder

#### Context

**Problem**: a removal that fails must not skip the action waiting behind it, and one failed holder must not poison every later use of the same checkout.

#### Business logic

A waiter chains on its predecessor's completion, not on its success: it runs whether the predecessor succeeded or failed. Each caller gets its own outcome, or its own error, back untouched. Once the last holder of a key has settled, the key is released.
