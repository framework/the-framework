One agent's [1] action bar, one row that never wraps: at the start, what the agent is (its name, its branch facts, its one-word status, and a summary of what its branch holds, together forming a disclosure), and at the end, what the user can do to it (the count of errors it hit, the handoff's [2] next step as a visible button, and one "⋮" menu holding everything else). The same bar serves the agent running and finished, so the controls stay put when the agent reaches its end.

## Context

**User story**: the user reads one line and knows which agent this is, what state it is in and what its branch holds, and finds the one thing that moves the work forward (push, open a pull request) without hunting through icon buttons that come and go with the agent's state.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] next step: what a person can do with an ended agent's work from the dashboard: open a pull request for its branch, or merge the pull request it has.
[4] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[5] stop: ending an agent before it finishes: the Stop button, Ctrl-C, or a pick marked to stop.
[6] card: an agent's record as the daemon hands it to the dashboard with the project's list of agents: its status, its branch, its pull request, and what only the daemon knows, such as whether the agent is saving: ended clean while the tool that runs it still saves its record and cleans up its checkout.

## Business logic — TL;DR

- **Facts at the start, controls at the end** - the row holds the agent's identity and branch facts first and its controls last, and only the facts give up width, so the controls never drop under them.
- **One status word** - exactly one ranked status is shown beside the branch's clean/dirty dot, with a colored dot; a failure shows just "failed", its reason on hover.
- **The controls cluster** - the error count, the next step [2] kept out as a visible button, and the "⋮" menu with every other action.
- **Facts shown together** - until the caller says the agent's own facts have been read, the row names the agent and shows none of its facts: no status word, no summary, no error count, no next step; the "⋮" menu stays.
- **What the menu is told** - a Delete is only offered for a finished agent; a Remove only while the agent's checkout is still kept; a Stop addresses the agent by its id.

## Business logic

### Facts at the start, controls at the end

#### Context

**Problem**: a bar that reflows moves everything below it, and the user is most often reading the feed under it when the agent's state changes.

#### Business logic

The row is always one line. Its start is the branch facts row (`GitStatusBar.tsx`), rendered inline and given: the agent's [1] label as the leading identity, its project name as a `project / session` breadcrumb, the caller's summary of what the branch holds, the status word described below, and, when the caller renders a detail under the bar, the toggle that makes the facts a disclosure with an expanded and collapsed state. The facts read from the agent's own checkout [4] when the agent's id is known. A spacer between facts and controls grows but never shrinks, so on a tight row the facts truncate and the controls keep their width.

### One status word

#### Context

**User story**: the user sees at a glance whether the agent is building, ready for merge, failed, stopped or waiting for an answer, without a banner row over the feed spending a whole line on one word.

#### Business logic

The bar shows at most one status, decided by the ranking in `lib/agent-status.ts` from the agent's events and, when the caller hands it over, the agent's card [6] (its status, its pull request, and whether the daemon marks it saving) and the number of the agent's subagents (the agents started for it, when it split its task across them) that still hold its job, as the caller counts them: how the agent [1] ended ("failed", "stopped", or "waiting for an answer") outranks what it did on the way ("<N> subagents running" while an agent that ended clean still has subagents running, "saving…" while the daemon marks a cleanly ended agent saving, "ready for merge" once it ended clean with a pull request on its card, "building…" while it runs, "finished" otherwise). Nothing is shown while the agent has no event and no card. The status sits beside the branch's clean/dirty dot as one line of facts, drawn as a colored dot and the word in its tone. A failure shows the word "failed" alone, and hovering it shows the reason its end carried, whole: cut to fit the row, the reason read as "codex exited (1): Y…" and said nothing, and the feed's end line below says it whole anyway.

### The controls cluster

#### Context

See `## Context`.

#### Business logic

At the end of the row, in order:

- the count of errors the agent [1] hit (`AgentErrorCount.tsx`), kept here with the controls rather than among the branch facts because a count is only useful when it is whole and the facts give up width;
- the next step [2], passed in by the caller once the agent has ended ("Open PR", or "Merge PR", or the reason there is nothing to press): the one control that moves the work forward, so it stays visible instead of going into the menu;
- the "⋮" menu (`AgentActionsMenu.tsx`) with every other action.

### Facts shown together

#### Context

**User story**: switching between agents in the left rail, the user used to see the bar fill in over several steps, with facts left from the previous agent under the new agent's name for a moment. Now the name shows at once and the facts appear together.

#### Business logic

The caller tells the bar whether the agent's [1] own facts have been read (the agent's page decides, see `AgentView.tsx`). Until they have, the bar shows the agent's name and project and holds back everything that describes the agent: the status word, the summary of what its branch holds, the branch facts (`GitStatusBar.tsx` is told the same), the error count and the next step [2]. The "⋮" menu stays, since it describes nothing. Once ready, they all show together. A caller that says nothing counts as ready.

### What the menu is told

#### Context

**Problem**: the same menu serves a running and a finished agent [1], so what it may offer is decided here from what the bar knows.

#### Business logic

- The menu offers Delete only when the caller gave the bar somewhere to go after the deletion, which the caller does only for a finished agent.
- The menu offers to remove the agent's checkout [4] only while the caller says the checkout is still kept on disk, and it tells the caller once the checkout is removed so the item goes.
- A stop [5] from the menu addresses the agent by its id.
