One agent's action bar: what the agent *is* on the left — its session name, its project, its branch and what that branch holds — and what the user can *do* to it on the right. The same bar serves the agent while it runs and after it finishes, so its controls stay in place when it reaches Done.

## Business logic — TL;DR

- **Identity first, git second** - the agent's session name leads, prefixed by its project as a `project / session name` breadcrumb; its branch, its uncommitted work, its size on disk and its PR follow as git context.
- **One status word** - exactly one of failed (with its reason), stopped, publishing, ready for merge, building or finished is shown, beside the branch facts rather than in a banner of its own.
- **Unresolved errors are counted** - what the agent could not get past is counted next to the controls, where the count cannot be truncated away.
- **Only the next step is a button** - the handoff's next step (Push, Open PR) stays visible; every other action lives behind one overflow menu.
- **The row never wraps** - the branch and its summary give up width as the bar fills, but the controls stay on the same line.

## Business logic

### Identity first, git second

#### User story

The user looks at an agent and needs to know which task it is, in which project, and where its work currently sits.

#### Business logic

The bar leads with the agent's session name, preceded by its project name, and then states where the agent is working: its branch, whether that checkout holds uncommitted work, how much disk it takes, and the PR its branch has. A short summary of what the branch holds sits beside the branch. When the caller renders detail underneath, the branch doubles as the disclosure that expands and collapses it.

### One status word

#### User story

An agent can hold several facts at once — it can signal ready for merge and then be stopped, or fail after signalling it — and the user needs the one that is true now.

#### Business logic

A single status is shown: failed (carrying the failure's reason), stopped, publishing, ready for merge, building, or finished; nothing is shown until the agent has named itself, reached one of those states, or ended. It sits with the branch facts, since "dirty · ready for merge" is one line of facts about the agent, while the end of the row is reserved for its controls. A failure's reason is capped in width so it cannot crowd out the branch.

### What the user can do

#### User story

The set of sensible actions changes as an agent progresses, and a row of buttons that appear and disappear is hard to aim at.

#### Business logic

The end of the bar carries, in order: the count of the agent's unresolved errors, the handoff's next step as a visible button (the one control that moves the work forward), and a single overflow menu holding everything else. The menu is told whether this finished agent still has a worktree on disk, so removing it can be offered, and whether the agent may be deleted at all; the caller is notified after a worktree removal or a deletion so it can drop the agent from view.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
