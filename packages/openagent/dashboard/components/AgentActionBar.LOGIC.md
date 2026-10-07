One agent's [1] action bar, the bar at the top of the agent's page, one row that never wraps, laid out as the top bar of Claude Code on the web is: at the start, the agent's name with a small "⌄", which is the button of the agent's menu [6]; beside it a grey chip saying where the agent runs and its project; and at the end, the count of errors it hit and the "⋮" button of the project's menu [7]. The bar says no word for the agent's state (building, finished, failed, stopped and so on) and not whether its checkout [4] is clean or dirty: the feed and the message box say whether the agent works and how it ended. The agent's branch, what the branch holds, its pull request and the next step [2] are not here either: they are in the bar above the message box (`AgentWorkBar.tsx`), which is drawn while there is something to say about the agent's work. The same action bar serves the agent running and finished, so the controls stay put when the agent reaches its end.

## Context

**User story**: the user reads one line and knows which agent this is, where it runs and in which project, and finds everything they can do to the agent in the menu behind its name, without hunting through icon buttons that come and go with the agent's state. The one thing that moves the work forward (commit, open a pull request, merge) is where they type, in the bar above the message box.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] next step: what a person can do with an ended agent's work from the dashboard: open a pull request for its branch, or merge the pull request it has.
[4] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[5] stop: ending an agent before it finishes: the Stop button, Ctrl-C, or a pick marked to stop.
[6] agent's menu: the menu that opens from the agent's name in the action bar, holding what belongs to the agent (`AgentActionsMenu.tsx`).
[7] project's menu: the "⋮" menu at the end of the action bar, holding what belongs to the agent's project (`AgentActionsMenu.tsx`).

## Business logic — TL;DR

- **The name at the start, the project's menu at the end** - the row holds the agent's name, which is the button of the agent's menu [6], then the chip, and last the error count and the project's menu [7]; only the name gives up width, so what is at the end never drops under it.
- **The chip beside the name** - "<where the agent runs> · <project>", or where it runs alone when no project is named; "This machine" when the caller does not say where.
- **One read of the checkout** - the bar is handed the agent's checkout [4] as the agent's page read it, and reads nothing itself.
- **No status word, no clean or dirty** - the bar says the same for a running, a finished, a failed, a stopped and a waiting agent, whatever its checkout holds.
- **The end of the row** - the error count, then the project's menu [7].
- **Facts shown together** - until the caller says the agent's own facts have been read, the row names the agent and shows none of its facts: no error count, and no size handed to the agent's menu [6]; the chip and the two menus stay.
- **What the agent's menu is told** - a Delete is only offered for a finished agent; a Remove only while the agent's checkout is still kept, with the checkout's size beside it; a Stop addresses the agent by its id; the details under the bar are shown and hidden from it when the caller renders any.

## Business logic

### The name at the start, the project's menu at the end

#### Context

**Problem**: a bar that reflows moves everything below it, and the user is most often reading the feed under it when the agent's state changes.

#### Business logic

The row is always one line. Its start is the agent's [1] name, the label the caller passes, which is the button of the agent's menu [6]; a name the caller does not have yet is handed on as no name, and the button is there all the same. The chip follows it (see "The chip beside the name"). A spacer between the chip and the end of the row grows but never shrinks, so on a tight row the name truncates and the error count and the project's menu [7] keep their width.

### The chip beside the name

#### Context

**User story**: the user runs agents on this machine, on other devices and in the cloud, in several projects, and wants to see at a glance where this one runs and which project it belongs to.

#### Business logic

A grey chip after the name reads "<where the agent runs> · <project name>", for example "This machine · gemstack". Where the agent runs is the few words the caller passes (the agent's page decides them, see `AgentView.tsx`); a caller that passes none gets "This machine". With no project name the chip says where the agent runs alone. The chip is cut at a fixed width, with its whole text on hover, and a bar too narrow for it leaves it out, so the name keeps its room.

### One read of the checkout

#### Context

**Problem**: the agent's checkout [4] is used by two bars of the agent's page: its size here, the branch and the pull request in the bar above the message box. Read by each bar for itself, the two could disagree for a moment, and the daemon was asked twice.

#### Business logic

The caller hands the bar the agent's checkout as it read it (the agent's page reads it once for both bars, see `AgentView.tsx`), or says that the read has not answered yet. The bar reads nothing itself. Of the checkout it uses the size on disk alone, and does not show it in the row: it hands the size to the agent's menu [6], which says it beside "Remove worktree".

### No status word, no clean or dirty

#### Context

**User story**: the user already sees whether the agent works and how it ended in the feed under the bar and in the message box, and what its checkout [4] holds in the bar above the message box. The top bar does not say any of it a second time.

#### Business logic

The bar shows no word and no dot for the agent's [1] state: not "building…", "finished", "saving…", "failed", "stopped", "waiting for an answer", "ready for merge" or a count of running subagents. It shows no "clean" or "dirty" for the agent's checkout either. A running, a finished, a failed, a stopped and a waiting agent with the same name, place, project and errors show the same bar.

### The end of the row

#### Context

See `## Context`.

#### Business logic

At the end of the row, in order:

- the count of errors the agent [1] hit (`AgentErrorCount.tsx`), kept here at the end rather than beside the name because a count is only useful when it is whole and the name gives up width;
- the project's menu [7] (`AgentActionsMenu.tsx`), which holds the project's page on its git host. For a project with no such page there is no "⋮" button, and its place is kept, so the count beside it does not move.

The next step [2] is not in this bar. It is a visible button at the end of the bar above the message box (`AgentWorkBar.tsx`).

### Facts shown together

#### Context

**User story**: switching between agents in the left rail, the user used to see the bar fill in over several steps, with facts left from the previous agent under the new agent's name for a moment. Now the name shows at once and the facts appear together.

#### Business logic

The caller tells the bar whether the agent's [1] own facts have been read (the agent's page decides, see `AgentView.tsx`). Until they have, the bar shows the agent's name and the chip and holds back everything that describes the agent: the error count, and the checkout's size, which is not handed to the agent's menu [6] (a size is only said once nothing is writing to the checkout). The two menus stay, since they describe nothing. Once ready, the facts all show together. A caller that says nothing counts as ready.

### What the agent's menu is told

#### Context

**Problem**: the same menu serves a running and a finished agent [1], so what it may offer is decided here from what the bar knows.

#### Business logic

- The agent's menu [6] offers Delete only when the caller gave the bar somewhere to go after the deletion, which the caller does only for a finished agent.
- It offers to remove the agent's checkout [4] only while the caller says the checkout is still kept on disk, with the checkout's size on disk beside the item, and it tells the caller once the checkout is removed so the item goes.
- A stop [5] from the menu addresses the agent by its id.
- When the caller renders a detail under the bar (the agent's page renders the details strip, `AgentDetails.tsx`), the menu is told whether that detail is shown and how to show and hide it; a caller that renders none gets no such item.

The project's menu [7] is told the project and the agent, and nothing of the above.
