The line that names an agent [2], at the start of the action bar at the top of the agent's page (`AgentActionBar.tsx`): the agent's name, its project as a breadcrumb before it, and the size on disk of the agent's checkout [1]. An agent's state, whether its checkout is clean or dirty, its branch and its pull request are not said in this line: the feed and the message box say whether the agent works and how it ended, and the rest is in the bar above the message box (`AgentWorkBar.tsx`). The line asks the daemon nothing: its caller hands it the checkout. The project home has no such line.

## Context

**User story**: on an agent's [2] page the line names the agent by its label with its project as a breadcrumb, then how much disk its checkout [1] takes; clicking the line opens the detail below it. The agent's branch, what the branch holds (uncommitted work included) and the pull request it opened are right above the message box, beside the next step (`AgentWorkBar.tsx`).

## Glossary

[1] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.

## Business logic — TL;DR

- **Handed the checkout** - the caller hands the line the agent's checkout as it read it; the line reads nothing itself and says one fact of the checkout, its size.
- **The name first, the size with the facts** - the agent's name and project show from the first frame; the size waits until the caller says the agent's facts are ready and the checkout has answered.
- **The agent's name, never the branch** - the name leads in bold, prefixed by "<project> ›", which stays in view (capped) however long the name is; no branch is shown, also while the name is not given.
- **The size** - the checkout's size on disk shows after the name once the daemon could measure it; the size drops out as the bar narrows.
- **A disclosure when there is detail below** - when the caller renders detail under the bar, the line becomes a button with a chevron that turns when expanded; the chevron is drawn, dimmed, even while the name shows alone, so the name never moves when the size lands.

## Business logic

### Handed the checkout

#### Context

**Problem**: an agent's page says the agent's checkout [1] in two bars, this line in the action bar at its top and the bar above the message box. Read by each for itself, the two could disagree for a moment, and the daemon was asked twice.

#### Business logic

The caller hands the line the agent's [2] checkout [1] as it read it, or says that its read has not answered yet (the agent's page reads the checkout once for both bars, see `AgentView.tsx` and `lib/use-checkout-status.ts`). The line asks the daemon nothing. It says one fact of the checkout: its size on disk. It says neither the agent's branch, nor whether the checkout is clean or dirty, nor its pull request, and it links no pull request. Once the agent has ended and its checkout is gone there is no size, and the line is the agent's name alone.

### The name first, the size with the facts

#### Context

**User story**: switching between agents, the user sees the new agent's name at once, and its facts together a moment later, never in pieces.

#### Business logic

The caller says whether its own facts about the agent [2] have been read (the agent's page does, see `AgentView.tsx`). Until it says they are ready, the name and breadcrumb show alone, whatever checkout was handed in. Once ready, the line does not wait for the checkout's answer: it shows the name as a working disclosure at once, and the size when the checkout has answered. A new agent's checkout is read up to ten seconds after it starts. A caller that says nothing counts as ready.

### The agent's name, never the branch

#### Context

**Problem**: the agent [2] renames its branch near the end of its work, while its label does not change under the user. And the agent's branch is what the next step acts on, so it is said beside the next step, above the message box, and not a second time here.

#### Business logic

The agent's label leads in bold and is the last element to truncate, so the identity never disappears. A project name given with it is prefixed as a muted "<project> ›" breadcrumb that is always shown (`›`, not `/`, so a label that is a command, such as `/update-tickets`, never reads as a doubled slash): it keeps its width up to a cap of 8rem (about 16 characters), a longer project name is cut there with "…", and a long agent name is what gives up the rest of the row. No branch is shown, with a label or without one: a line shown without a label holds the size alone.

### The size

#### Context

**User story**: the user sees how much disk an agent's [2] checkout [1] takes, to decide whether to remove it.

#### Business logic

The checkout's [1] size on disk, rendered as a short byte count such as "5 MB", sits after the agent's name. It shows only once the daemon has measured it, which it does not while something is still writing to the checkout; its tooltip reads "This agent's worktree on disk", and an unmeasured size shows nothing, not a placeholder. As the bar narrows, the size drops out, so the line never wraps or collides; only the label truncates with an ellipsis. On a pane too narrow even for that, the line is cut off rather than painted over the controls beside it.

### A disclosure when there is detail below

#### Context

**Problem**: the detail about an agent (which coding agent ran it, which model, what it cost) needs a way in that takes no row of its own; clicking the agent's name is how the detail below opens.

#### Business logic

When the caller offers a toggle, the line becomes a button, preceded by a chevron that points right while collapsed and down while expanded, and clicking it toggles the detail the caller renders below. Without a toggle no chevron shows, so the bar never advertises a disclosure it does not have. While the caller's facts are not ready, the name is not a button yet, and the chevron is still drawn in the same place, dimmed, before the name: the line is laid out the same way before and after, so the name keeps its position and only the size appears beside it.
