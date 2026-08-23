The dashboard's status line for the git checkout currently in play: which branch it is on, whether it holds uncommitted changes, how big it is on disk, and the pull request opened from it. One bar serves both the project's own checkout and an individual agent's worktree, so the same facts are always stated the same way wherever the user is.

## Business logic — TL;DR

- **Whose checkout is reported** - asked about an agent, it reports that agent's worktree (which additionally has a path and a size on disk); asked about a project alone, it reports the project's checkout.
- **Kept current while work happens** - the status is re-read every ten seconds so a branch rename or a fresh commit shows up on its own; while a pull request lookup is still resolving it re-reads every second instead, because that answer lands in well under ten.
- **Nothing to say, nothing shown** - a location with no git repository renders no bar at all.
- **Agent name leads, branch follows** - given an agent's name, the name is the bold identity and the branch drops to muted context beside it; without a name the branch itself is the identity.
- **Clean is unremarkable** - a dirty tree is flagged in warning colour, a clean one stays neutral, and the wording distinguishes uncommitted work that belongs to the agent from uncommitted work that belongs to the user.
- **The branch as a disclosure** - where the caller has detail to show underneath, the bar's facts become the control that expands it, so an agent's branch is spoken about in exactly one place.

## Business logic

### Whose checkout is reported

#### User story

The user looks at a project's home page and wants to know what the repository is sitting on; the user opens one agent and wants to know what that agent's own throwaway checkout is sitting on. Both are the same question.

#### Business logic

Named an agent, the bar reports that agent's worktree: branch, clean or dirty, the pull request, plus the worktree's path and its size on disk. Named only a project, it reports the project's checkout, which has branch, clean or dirty, and the pull request but no path or size. The size is shown only once it is known, that is only when nothing is still writing to the worktree.

An agent's worktree is the agent's own tree, so uncommitted changes there are described as the agent's; on a project's checkout the same dot describes the user's uncommitted changes.

#### Rationale

An agent used to get its own separately styled chip, so the identical facts wore two different looks depending on the page and either could drift when the other was edited.

### Kept current while work happens

#### User story

While an agent works, it commits, and near the end it renames its branch to `tf-<session name>`. The user watching the bar should see that happen rather than a stale line.

#### Business logic

The status is re-read on a ten-second cadence at rest. When the reported status says the pull request lookup is still in flight, the cadence tightens to one second until it resolves. While the next checkout's status is loading, the previously known status stays on screen so the whole cluster updates in place rather than blanking out and popping back.

### The branch as a disclosure

#### User story

The user wants to expand an agent's branch detail without the branch name being repeated on a second card underneath.

#### Business logic

Where the caller supplies an expand action, the branch facts become the control that opens and closes the detail rendered below, and a chevron marks it as openable. Where there is nothing to open, no chevron appears. The pull request link stays outside that control so it remains independently clickable.

### What the bar states, in priority order

#### User story

The dashboard shows this bar in panes of very different widths — a full-width row on a page, a compact segment inside an action bar.

#### Business logic

The bar reads left to right as: the agent's name (prefixed by its project as a `project / agent` breadcrumb where both are known), the branch, the clean-or-dirty dot, the agent's own state (stopped, ready for merge, and so on), the worktree size, and a phrase saying what the branch holds. The pull request, with its number and its state, sits at the far end and links out to it.

As the bar narrows, the facts furthest from the branch drop out first, then the branch truncates, and the agent's name truncates last — the identity is the thing that must never disappear. Beside an agent's name the branch is shown without its `the-framework/` prefix, which every branch shares; the full branch name and the worktree path stay available on hover.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
