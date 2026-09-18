One agent's [1] action bar, one row that never wraps: at the start, what the agent is (its name, its branch facts, its one-word status, and a summary of what its branch holds, together forming a disclosure), and at the end, what the user can do to it (the count of errors it hit, the handoff's [2] next step as a visible button, and one "⋮" menu holding everything else). The same bar serves the agent running and finished, so the controls stay put when the agent reaches its end.

## Context

**User story**: the user reads one line and knows which agent this is, what state it is in and what its branch holds, and finds the one thing that moves the work forward (push, open a pull request) without hunting through icon buttons that come and go with the agent's state.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] next step: what a person can do with an ended agent's work from the dashboard: open a pull request for its branch, or merge the pull request it has.
[3] session name: the name an agent gives its own work (`[a-z0-9-]+`); its branch is renamed to `agent-<session name>` and the dashboard labels the agent by it.
[4] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[5] stop: ending an agent before it finishes: the Stop button, Ctrl-C, or a pick marked to stop.
[6] card: an agent's record as the daemon hands it to the dashboard with the project's list of agents: its status, its branch, its pull request, and what only the daemon knows, such as whether the agent is publishing: ended clean while the tool that runs it still records it and pushes its branch.

## Business logic — TL;DR

- **Facts at the start, controls at the end** - the row holds the agent's identity and branch facts first and its controls last, and only the facts give up width, so the controls never drop under them.
- **One status word** - exactly one ranked status is shown beside the branch's clean/dirty dot, with a colored dot and a capped width; the full text is on hover.
- **The controls cluster** - the error count, the next step [2] kept out as a visible button, and the "⋮" menu with every other action.
- **What the menu is told** - a Delete is only offered for a finished agent; a Remove only while the agent's checkout is still kept; a Stop addresses the agent by its id.

## Business logic

### Facts at the start, controls at the end

#### Context

**Problem**: a bar that reflows moves everything below it, and the user is most often reading the feed under it when the agent's state changes.

#### Business logic

The row is always one line. Its start is the branch facts row (`GitStatusBar.tsx`), rendered inline and given: the agent's [1] session name [3] as the leading identity, its project name as a `project / session` breadcrumb, the caller's summary of what the branch holds, the status word described below, and, when the caller renders a detail under the bar, the toggle that makes the facts a disclosure with an expanded and collapsed state. The facts read from the agent's own checkout [4] when the agent's id is known. A spacer between facts and controls grows but never shrinks, so on a tight row the facts truncate and the controls keep their width.

### One status word

#### Context

**User story**: the user sees at a glance whether the agent is building, ready for merge, failed, stopped or waiting for an answer, without a banner row over the feed spending a whole line on one word.

#### Business logic

The bar shows at most one status, decided by the ranking in `lib/agent-status.ts` from the agent's events and, when the caller hands it over, the agent's card [6] (its status, its pull request, and whether the daemon marks it publishing): how the agent [1] ended ("failed", or "failed — <reason>" when the end carried a reason, "stopped", or "waiting for an answer") outranks what it did on the way ("publishing…" while the daemon marks a cleanly ended agent publishing, "ready for merge" once it ended clean with a pull request on its card, "building…" while it runs, "finished" otherwise). Nothing is shown while the agent has no event and no card. The status sits beside the branch's clean/dirty dot as one line of facts, drawn as a colored dot and the word in its tone. The word's width is capped and truncated with an ellipsis, because a failure carries its reason and must not take the row from the branch; hovering the status shows the full text.

### The controls cluster

#### Context

See `## Context`.

#### Business logic

At the end of the row, in order:

- the count of errors the agent [1] hit (`AgentErrorCount.tsx`), kept here with the controls rather than among the branch facts because a count is only useful when it is whole and the facts give up width;
- the next step [2], passed in by the caller once the agent has ended ("Open PR", or "Merge PR", or the reason there is nothing to press): the one control that moves the work forward, so it stays visible instead of going into the menu;
- the "⋮" menu (`AgentActionsMenu.tsx`) with every other action.

### What the menu is told

#### Context

**Problem**: the same menu serves a running and a finished agent [1], so what it may offer is decided here from what the bar knows.

#### Business logic

- The menu offers Delete only when the caller gave the bar somewhere to go after the deletion, which the caller does only for a finished agent.
- The menu offers to remove the agent's checkout [4] only while the caller says the checkout is still kept on disk, and it tells the caller once the checkout is removed so the item goes.
- A stop [5] from the menu addresses the agent by its id.
