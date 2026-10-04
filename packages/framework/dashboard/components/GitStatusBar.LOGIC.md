The one line of git facts about the checkout [1] in play, shown on the project home for the project's own checkout (its branch, whether it is clean or dirty, and the linked pull request) and in the action bar at the top of an agent's [2] page for that agent's checkout (the agent's name, the agent's state, whether its checkout is clean or dirty, and the checkout's size on disk), kept current on a clock so it tracks an agent committing. An agent's branch and its pull request are not said in this line: they are in the bar above the message box (`AgentWorkBar.tsx`). It renders nothing when there is no repository or checkout to report, except the agent's name, which shows from the first frame.

## Context

**User story**: on a project's page the user sees which branch the project is on, whether there are uncommitted changes and whether the branch has a pull request. On an agent's [2] page the same line names the agent by its label with its project as a breadcrumb, then what the agent is up to, whether the agent has uncommitted work, and how much disk its checkout [1] takes; clicking the line opens the detail below it. The agent's branch, what the branch holds and the pull request it opened are right above the message box, beside the next step (`AgentWorkBar.tsx`).

## Glossary

[1] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. The user's own working copy is "the project's checkout".
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.

## Business logic — TL;DR

- **Whose checkout** - with an agent selected the line reports that agent's checkout, which alone has a path and a size while it exists; otherwise the project's own checkout; nothing renders when there is no checkout to report.
- **Kept current** - the facts are re-read every 10 seconds, or every 0.3 seconds while the daemon's pull request lookup is still in flight (`lib/use-checkout-status.ts`); a caller that already read the checkout hands it in, and the line reads nothing itself.
- **Switching agents** - the facts are remembered per checkout for as long as the page is open: going back to an agent shows its facts from the first frame while they are read again; an agent never shown has no facts until its own are read, never the previous agent's. Until then, and while the caller says its own facts are not in yet, the agent's name and project show alone.
- **The agent's name, or the branch** - given the agent's name it leads in bold, prefixed by "<project> ›", which stays in view (capped) however long the name is, and no branch is shown; the branch is the identity only on the project home, with the full branch in its tooltip; an agent's line never says a branch, also while its name is not given.
- **Clean or dirty, neutrally** - a dot and the word "clean" in neutral gray or "dirty" in amber; the tooltip reads "Clean", "Uncommitted changes", or "Uncommitted changes in this agent" on an agent's checkout; an agent whose checkout is gone shows neither.
- **State and size** - the agent's state sits right after the name, before clean or dirty, and the checkout's size on disk shows once the daemon could measure it; the size drops out as the bar narrows.
- **The pull request link** - on the project home: "PR #<number>" with its state in a pill, opening the pull request in a new tab, its title in the tooltip; on an agent's line, no link.
- **A disclosure when there is detail below** - when the caller renders detail under the bar, the facts become a button with a chevron that turns when expanded; the chevron is drawn, dimmed, even while the name shows alone, so the name never moves when the facts land.

## Business logic

### Whose checkout

#### Context

See `## Context`.

#### Business logic

With an agent [2] selected, the line reports that agent's checkout [1]: its branch, whether it is dirty, its pull request, and what only an agent's checkout has — the path it lives at and its size on disk. Once the agent has ended and its checkout is gone, the daemon answers only the branch the agent recorded and its pull request, so the line shows no clean or dirty: the project's own checkout is the user's, and its facts are never shown as the agent's. Without an agent, it asks about the project's own checkout: branch, dirty or clean, pull request. When the daemon has nothing to report, because there is no repository or no such agent, the line renders nothing at all.

### Kept current

#### Context

**Problem**: an agent [2] commits, renames its branch and opens a pull request while the user watches; and the daemon's pull request lookup, while still in flight, answers within a second, which is worth asking again for rather than showing a gap for ten seconds.

**Problem**: an agent's page says the agent's checkout [1] in two bars, this line in the action bar at its top and the bar above the message box. Read by each for itself, the two could disagree for a moment, and the daemon was asked twice.

#### Business logic

The read is `lib/use-checkout-status.ts`'s. The facts are re-read every 10 seconds; while the daemon reports its pull request lookup as still pending, every 0.3 seconds. When the selected agent changes, the line never shows the previous agent's facts under the new agent's name: that read as this agent's own for the moment the read took. Instead the facts are remembered per checkout (each agent's checkout, and the project's own checkout, under their own key) for as long as the page is open. Going back to an agent seen before shows its remembered facts from the first frame, and they are read again at once, so the fresh answer replaces them as soon as it lands. An agent never shown before shows only its name and its "<project> ›" breadcrumb until its facts are read.

A caller that already read the checkout hands it to the line, or says that its read has not answered yet (the agent's page does: it reads the agent's checkout once for both bars, see `AgentView.tsx`). The line then asks the daemon nothing, shows what it was handed, and shows the name alone while the read has not answered.

The caller can also hold the facts back while its own facts about the agent are still being read (the agent's page does, see `AgentView.tsx`): until it says they are ready, the name and breadcrumb show alone, so the whole line of facts appears together rather than in pieces.

### The agent's name, or the branch

#### Context

**Problem**: for the moment an agent's name was not known yet, its line showed the branch in the name's place, or "no branch", and the name replaced it a moment later.

**Problem**: the agent [2] renames its branch near the end of its work, while its label does not change under the user. And the agent's branch is what the next step acts on, so it is said beside the next step, above the message box, and not a second time here.

#### Business logic

When the caller gives the agent's label, it leads in bold and is the last element to truncate, so the identity never disappears. A project name given with it is prefixed as a muted "<project> ›" breadcrumb that is always shown (`›`, not `/`, so a label that is a command, such as `/update-tickets`, never reads as a doubled slash): it keeps its width up to a cap of 8rem (about 16 characters), a longer project name is cut there with "…", and a long agent name is what gives up the rest of the row. Given a label, no branch is shown in this line. On the project home (no label and no agent) the branch is the identity, in bold, capped at 16 rem, its tooltip reading "branch <branch>"; a checkout on no branch reads "no branch". For an agent's checkout [1] no branch is shown, with a label or without one: an agent's line shown without a label starts at the agent's state.

### Clean or dirty, neutrally

#### Context

**Problem**: green means "added", "new" or "done" everywhere else in the dashboard, and the file tree's green dot one pane away says a folder has changes; a green dot for "nothing changed" would give the same color to opposite facts. A clean tree is the unremarkable default and has nothing to announce.

#### Business logic

A dot and a word: "clean" with a neutral gray dot, or "dirty" with an amber dot. The tooltip reads "Clean" when clean. When dirty it reads "Uncommitted changes in this agent" on an agent's [2] checkout [1], since the uncommitted work there is the agent's, and "Uncommitted changes" on the project's checkout, where the work is the user's. An agent whose checkout is gone has no tree to be either, so neither the dot nor the word shows.

### State and size

#### Context

**Problem**: the agent's [2] state (stopped, ready for merge, and so on, as the caller words it) belongs with the tree's own clean or dirty, as one line of facts about the agent, while the far end of the bar is where its controls live.

**Problem**: clean or dirty is there only while the agent has a checkout. With the state after it, the state jumped left when the checkout went and right when it came back.

#### Business logic

The agent's state, as worded by the caller, sits right after the name (or the branch, on a line that shows one) and before the clean or dirty dot: clean or dirty comes and goes after the state, and the state keeps its place. The checkout's [1] size on disk, rendered as a short byte count such as "5 MB", shows only for an agent's checkout and only once the daemon has measured it, which it does not while something is still writing to it; its tooltip reads "This agent's worktree on disk", and an unmeasured size shows nothing, not a placeholder. As the bar narrows, the size drops out, so the line never wraps or collides; only the label, or the branch when there is no label, truncates with an ellipsis. On a pane too narrow even for that, the line is cut off rather than painted over the controls beside it.

### The pull request link

#### Context

See `## Context`.

#### Business logic

On the project home, when the branch has a pull request, a link reads "PR #<number>" followed by the pull request's state in lowercase inside a small pill ("open", "merged", "closed"); it opens the pull request in a new tab and shows the pull request's title in its tooltip. On the full-width row it sits at the far right; inline, it follows the facts. An agent's [2] line shows no pull request link: the bar above the message box links it (`AgentWorkBar.tsx`).

### A disclosure when there is detail below

#### Context

**Problem**: the detail about an agent (which coding agent ran it, which model, what it cost) needs a way in that takes no row of its own; clicking the agent's name is how the detail below opens.

#### Business logic

When the caller offers a toggle, the facts become a button, preceded by a chevron that points right while collapsed and down while expanded, and clicking it toggles the detail the caller renders below; the pull request link, where there is one, stays outside the button, being a link in its own right. Without a toggle no chevron shows, so the bar never advertises a disclosure it does not have. Inline, the bar renders as a compact span for an action bar; otherwise as a full-width row with a bottom border. While the facts are not shown yet (not read, or the caller not ready), the chevron is still drawn in the same place, dimmed, before the name: the line is laid out the same way before and after, so the name keeps its position and only the facts appear beside it. It used to appear with the facts and shift the whole line.
