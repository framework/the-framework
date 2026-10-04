One agent's [1] action bar, the bar at the top of the agent's page, one row that never wraps: at the start, which agent this is (its project, its name and its checkout's [4] size, together forming a disclosure), and at the end, the count of errors it hit and one "⋮" menu holding what the user can do to it. The bar says no word for the agent's state (building, finished, failed, stopped and so on) and not whether its checkout is clean or dirty: the feed and the message box say whether the agent works and how it ended. The agent's branch, what the branch holds, its pull request and the next step [2] are not here either: they are in the bar above the message box (`AgentWorkBar.tsx`), which is drawn while there is something to say about the agent's work. The same action bar serves the agent running and finished, so the controls stay put when the agent reaches its end.

## Context

**User story**: the user reads one line and knows which agent this is, and finds everything they can do to the agent in one menu, without hunting through icon buttons that come and go with the agent's state. The one thing that moves the work forward (commit, open a pull request, merge) is where they type, in the bar above the message box.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] next step: what a person can do with an ended agent's work from the dashboard: open a pull request for its branch, or merge the pull request it has.
[4] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[5] stop: ending an agent before it finishes: the Stop button, Ctrl-C, or a pick marked to stop.

## Business logic — TL;DR

- **The name at the start, controls at the end** - the row holds the agent's identity first and its controls last, and only the identity gives up width, so the controls never drop under it.
- **One read of the checkout** - the bar is handed the agent's checkout [4] as the agent's page read it, and reads nothing itself.
- **No status word, no clean or dirty** - the bar says the same for a running, a finished, a failed, a stopped and a waiting agent, whatever its checkout holds.
- **The controls cluster** - the error count and the "⋮" menu with every action on the agent.
- **Facts shown together** - until the caller says the agent's own facts have been read, the row names the agent and shows none of its facts: no size, no error count; the "⋮" menu stays.
- **What the menu is told** - a Delete is only offered for a finished agent; a Remove only while the agent's checkout is still kept; a Stop addresses the agent by its id.

## Business logic

### The name at the start, controls at the end

#### Context

**Problem**: a bar that reflows moves everything below it, and the user is most often reading the feed under it when the agent's state changes.

#### Business logic

The row is always one line. Its start is the line of git facts (`GitStatusBar.tsx`), rendered inline and given: the agent's [1] label as the leading identity, its project name as a "<project> ›" breadcrumb, and, when the caller renders a detail under the bar (the agent's page renders the details strip, `AgentDetails.tsx`), the toggle that makes the line a disclosure with an expanded and collapsed state. For an agent, that line says the size of the agent's checkout [4] and nothing else of it. A spacer between the line and the controls grows but never shrinks, so on a tight row the name truncates and the controls keep their width.

### One read of the checkout

#### Context

**Problem**: the agent's checkout [4] is said in two bars of the agent's page: its size here, the branch and the pull request in the bar above the message box. Read by each bar for itself, the two could disagree for a moment, and the daemon was asked twice.

#### Business logic

The caller hands the bar the agent's checkout as it read it (the agent's page reads it once for both bars, see `AgentView.tsx`), or says that the read has not answered yet. The bar passes it on to the line of git facts (`GitStatusBar.tsx`), which then reads nothing itself.

### No status word, no clean or dirty

#### Context

**User story**: the user already sees whether the agent works and how it ended in the feed under the bar and in the message box, and what its checkout [4] holds in the bar above the message box. The top bar does not say any of it a second time.

#### Business logic

The bar shows no word and no dot for the agent's [1] state: not "building…", "finished", "saving…", "failed", "stopped", "waiting for an answer", "ready for merge" or a count of running subagents. It shows no "clean" or "dirty" for the agent's checkout either. A running, a finished, a failed, a stopped and a waiting agent with the same name, size and errors show the same bar.

### The controls cluster

#### Context

See `## Context`.

#### Business logic

At the end of the row, in order:

- the count of errors the agent [1] hit (`AgentErrorCount.tsx`), kept here with the controls rather than beside the name because a count is only useful when it is whole and the name gives up width;
- the "⋮" menu (`AgentActionsMenu.tsx`) with every action on the agent.

The next step [2] is not in this bar. It is a visible button at the end of the bar above the message box (`AgentWorkBar.tsx`).

### Facts shown together

#### Context

**User story**: switching between agents in the left rail, the user used to see the bar fill in over several steps, with facts left from the previous agent under the new agent's name for a moment. Now the name shows at once and the facts appear together.

#### Business logic

The caller tells the bar whether the agent's [1] own facts have been read (the agent's page decides, see `AgentView.tsx`). Until they have, the bar shows the agent's name and project and holds back everything that describes the agent: the size (`GitStatusBar.tsx` is told the same) and the error count. The "⋮" menu stays, since it describes nothing. Once ready, they all show together. A caller that says nothing counts as ready.

### What the menu is told

#### Context

**Problem**: the same menu serves a running and a finished agent [1], so what it may offer is decided here from what the bar knows.

#### Business logic

- The menu offers Delete only when the caller gave the bar somewhere to go after the deletion, which the caller does only for a finished agent.
- The menu offers to remove the agent's checkout [4] only while the caller says the checkout is still kept on disk, and it tells the caller once the checkout is removed so the item goes.
- A stop [5] from the menu addresses the agent by its id.
