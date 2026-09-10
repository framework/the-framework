The one line of git facts about the checkout [1] in play — its branch, whether it is clean or dirty, the agent's [2] state, its size on disk, what the branch holds, and the linked pull request — shown on the project home for the project's own checkout and on an agent's page for that agent's checkout, re-read on a clock so it tracks an agent committing or branching. It renders nothing when there is no repository or checkout to report.

## Context

**User story**: on a project's page the user sees which branch the project is on, whether there are uncommitted changes and whether the branch has a pull request. On an agent's [2] page the same line names the agent by its session name [3] with its project as a breadcrumb, then the agent's branch, whether the agent has uncommitted work, what the agent is up to, how much disk its checkout [1] takes, what its branch holds, and the pull request it opened; clicking the line opens the branch detail below it.

## Glossary

[1] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. The user's own working copy is "the project's checkout".
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[3] session name: the name an agent gives its own work (`[a-z0-9-]+`); its branch is renamed after it and the dashboard labels the agent by it.

## Business logic — TL;DR

- **Whose checkout** - with an agent selected the line reports that agent's checkout, which alone has a path, an owner and a size; otherwise the project's own checkout; nothing renders when there is no checkout to report.
- **Kept current** - the facts are re-read every 10 seconds, or every second while the daemon's pull request lookup is still in flight; the previous facts stay on screen while the next agent's load.
- **Identity first, branch second** - given the agent's name it leads in bold, prefixed by "<project> /", and the branch drops to muted context with its `the-framework/` prefix hidden; without a name the branch is the identity; the full branch and the checkout's path live in the branch's tooltip.
- **Clean or dirty, neutrally** - a dot and the word "clean" in neutral gray or "dirty" in amber; the tooltip reads "Clean", "Uncommitted changes", or "Uncommitted changes in this agent" when the checkout is the agent's own.
- **State, size and summary** - the agent's state sits beside the dot, the checkout's size on disk shows once the daemon could measure it, and the summary of what the branch holds comes last; the facts furthest from the branch drop out first as the bar narrows.
- **The pull request link** - "PR #<number>" with its state in a pill, opening the pull request in a new tab, its title in the tooltip.
- **A disclosure when there is detail below** - when the caller renders detail under the bar, the facts become a button with a chevron that turns when expanded.

## Business logic

### Whose checkout

#### Context

See `## Context`.

#### Business logic

With an agent [2] selected, the line asks the daemon about that agent's checkout [1]: its branch, whether it is dirty, its pull request, and what only an agent's checkout has — the path it lives at, whether the checkout is the agent's own, and its size on disk. Without an agent, it asks about the project's own checkout: branch, dirty or clean, pull request. When the daemon has nothing to report, because there is no repository or the checkout is gone, the line renders nothing at all.

### Kept current

#### Context

**Problem**: an agent [2] commits, renames its branch and opens a pull request while the user watches; and the daemon's pull request lookup, while still in flight, answers within a second, which is worth asking again for rather than showing a gap for ten seconds.

#### Business logic

The facts are re-read every 10 seconds; while the daemon reports its pull request lookup as still pending, every second. When the selected agent changes, the previous facts stay visible until the new ones arrive, so the line updates in place instead of vanishing and popping back.

### Identity first, branch second

#### Context

**Problem**: the agent [2] renames its branch near the end of its work, while its session name [3] does not change under the user; and beside a session name the `the-framework/` prefix every agent branch shares is fourteen characters of noise.

#### Business logic

When the caller gives the agent's session name, it leads in bold and is the last element to truncate, so the identity never disappears. A project name given with it is prefixed as a muted "<project> /" breadcrumb that gives up width first. The branch then reads as muted context beside the name: a leading `the-framework/` is stripped from the shown text, the text is capped at 14 rem before truncating, and on a narrow bar the branch is hidden altogether; its tooltip shows the full branch and, for an agent's checkout [1], the checkout's path on a second line. Without a session name (the project home) the branch is the identity, in bold, capped at 16 rem, its tooltip reading "branch <branch>". A checkout on no branch reads "no branch".

### Clean or dirty, neutrally

#### Context

**Problem**: green means "added", "new" or "done" everywhere else in the dashboard, and the file tree's green dot one pane away says a folder has changes; a green dot for "nothing changed" would give the same color to opposite facts. A clean tree is the unremarkable default and has nothing to announce.

#### Business logic

A dot and a word: "clean" with a neutral gray dot, or "dirty" with an amber dot. The tooltip reads "Clean" when clean. When dirty it reads "Uncommitted changes in this agent" when the checkout [1] is the agent's [2] own, since the uncommitted work there is the agent's, and "Uncommitted changes" otherwise, on the project's checkout where the work is the user's.

### State, size and summary

#### Context

**Problem**: the agent's [2] state (stopped, ready for merge, and so on, as the caller words it) belongs with the tree's own clean or dirty, as one line of facts about the agent, while the far end of the bar is where its controls live.

#### Business logic

The agent's state, as worded by the caller, sits right after the dot. The checkout's [1] size on disk, rendered as a short byte count such as "5 MB", shows only for an agent's checkout and only once the daemon has measured it, which it does not while something is still writing to it; its tooltip reads "This agent's worktree on disk", and an unmeasured size shows nothing, not a placeholder. The summary of what the branch holds, as worded by the caller, comes last. As the bar narrows, the facts furthest from the branch drop out first — the summary, then the size, then the branch beside a name — so the line never wraps or collides; only the session name, or the branch when there is no name, truncates with an ellipsis. On a pane too narrow even for that, the line is cut off rather than painted over the controls beside it.

### The pull request link

#### Context

See `## Context`.

#### Business logic

When the branch has a pull request, a link reads "PR #<number>" followed by the pull request's state in lowercase inside a small pill ("open", "merged", "closed"); it opens the pull request in a new tab and shows the pull request's title in its tooltip. On the full-width row it sits at the far right; inline, it follows the facts. An agent's [2] pull request shows the same way the project's does.

### A disclosure when there is detail below

#### Context

**Problem**: a second card under the bar repeating the branch name would say the branch twice; the bar is the one place a branch is spoken about, and clicking it is how the detail below opens.

#### Business logic

When the caller offers a toggle, the facts become a button, preceded by a chevron that points right while collapsed and down while expanded, and clicking it toggles the detail the caller renders below; the pull request link stays outside the button, being a link in its own right. Without a toggle no chevron shows, so the bar never advertises a disclosure it does not have. Inline, the bar renders as a compact span for an action bar; otherwise as a full-width row with a bottom border.
