What an agent [2] left behind, as the user meets it on the agent's page: a one-line verdict of what the agent's branch holds, the next step offered as a button once the agent has ended (or the reason there is nothing to press), and the commits and files the branch holds. The verdict and the next step ride in the bar above the message box (`AgentWorkBar.tsx`), beside the branch they are about; the lists are behind the disclosure of the action bar at the top of the page. A subagent [5] is offered no next step: where the button would be, the bar above the message box says "landed" or "not landed". Below, "the bar" is the bar above the message box.

## Context

**User story**: an agent finishes and the user asks "what did it leave, and what do I do now?". The bar above the message box answers both in one line and offers the one step that moves the work forward, right where the user types, without the user leaving the dashboard for the command line, and without ever offering a button that GitHub can only refuse.

**Problem**: what the branch holds is read by branch name, not from the agent's checkout [3], because a clean agent's checkout is removed when it ends; the branch survives it.

**User story**: the user opens a subagent's [5] page. A subagent opens no pull request and nobody pushes its branch by hand: its main agent lands its work on the main agent's own branch. So the page offers no button; it says what the subagent changed and whether its main agent landed it yet.

## Glossary

[1] next step: what a person can do with an ended agent's work from the dashboard: publish it, which pushes its branch and opens a pull request for it, or merge the pull request it has; on a project with no git host package, push the branch.
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps. An agent's work stays on its branch, on this machine: the agent publishes it — pushes its branch, opens its pull request — only when its task or the person asks.
[3] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[4] intervention: something that needs a human — an open question, a pull request to review, unpushed commits — one of the two notification feeds.
[5] subagent: an agent another agent, its main agent, started for one task, on a branch started from the main agent's. It opens no pull request. Its main agent lands its work: merges it into the main agent's own branch and deletes the subagent's branch; the subagent's record keeps its last commit, which the daemon reads its commits and files by from then on. The caller says whether the agent is a subagent (`AgentView.tsx`); the daemon's read says whether it is landed.

## Business logic — TL;DR

- **The one-line verdict** - what the branch holds, in a phrase: "branch gone" (or "no changes" when the agent changed nothing), "merged", "no changes", or the commit and file counts with the lines added and removed, plus "pushed" for a branch on the remote with no pull request; a subagent's [5] verdict says neither, and a landed one whose last commit is not on this machine has no verdict.
- **A subagent: landed or not landed** - a subagent is offered no "Open PR", no "Merge PR" and no "Publish branch"; where the button would be, the bar says "landed" once its main agent landed its work and "not landed" while its branch holds commits that are not landed; work it left uncommitted is still named.
- **The next step, or why there is none** - once the agent has stopped: "Open PR" with "Create draft PR" and "Publish branch" in the menu beside it, or "Merge PR" for an open pull request, or "Publish branch" alone where the project has no git host package, or "Merge" where the repository has no remote, or "Commit" where the agent left its work uncommitted, or one sentence saying why nothing can be pressed; never a button the git host would refuse, and nothing at all while the pull request lookup is still out.
- **The lists behind the disclosure** - behind the action bar's disclosure, the commits (up to 6), the changed files (up to 10) and the uncommitted files (up to 10), the rest counted as "and N more"; shown only when there is something to list.

## Business logic

### The one-line verdict

#### Context

See `## Context`.

#### Business logic

Nothing is shown until the read of the branch has answered. Then, in the bar, muted:

- "branch gone" when the branch no longer exists (deleted, or never created). A gone branch and a never-pushed branch are different facts and the verdict tells them apart. When the daemon marks the gone branch as belonging to an agent that changed nothing, it reads "no changes" instead: its branch went only because it held nothing, and "branch gone" read as lost work.
- When the branch carries no commit the base branch does not already have: "merged" when the branch is merged into the base, otherwise "no changes". A merged branch whose record does not name where its work began also reads as empty, since all its commits are on the base, but "merged" and "no changes" are opposite verdicts and only one of them is true. A merged branch whose record names where its work began is not empty: it keeps its commit and file counts, as below.
- Otherwise the counts: "<N> commit" or "<N> commits", a middle dot, "<N> file" or "<N> files", and the lines added and removed. When the branch is on the remote at the same commit and no pull request is linked to it, "· pushed" follows. Whether the work is on the remote is the first question about its next step [1]. That it is not there yet is said beside the button that publishes it (below). The pull request itself is not repeated here, because the bar links it right after the verdict.

For a subagent [5] the verdict is the same, with two differences. No "· pushed" follows the counts: whether a subagent's branch is on the remote is no step toward anything, since its work goes to its main agent's branch. And a landed subagent whose last commit is not on this machine has no verdict at all, where another agent would read "branch gone": its branch is gone on purpose, there is nothing to count, and "landed" is said where the next step would be (below). A landed subagent whose last commit is on this machine reads its counts as any branch with work does.

### A subagent: landed or not landed

#### Context

See the second user story in `## Context`.

**Problem**: "Open PR" on a subagent would open a pull request for a part of the work, beside the one opened from its main agent's branch for the whole. "Branch gone — nothing to open a PR from." on a landed subagent would read as lost work.

#### Business logic

Shown once the agent has ended, in the place of the next step [1] (the caller's decision, in `AgentView.tsx`). A subagent is offered no button, whatever its branch holds: not "Open PR", not "Merge PR" even when its branch has an open pull request, not "Publish branch" even where the project has no git host package. Nothing is rendered until the read of the branch has answered. Then, the first rule that applies:

- The daemon's read says the subagent is landed: "landed".
- The branch is gone, or carries no commit beyond the commit the subagent's own work begins at: nothing when the checkout [3] holds no uncommitted files; otherwise the same "Nothing committed — <files> left uncommitted." sentence as for any other agent (below), since nothing lands uncommitted work.
- Otherwise: "not landed".

The line does not wait for the pull request lookup: no rule of a subagent's reads a pull request.

### The next step, or why there is none

#### Context

**User story**: an agent [2] has ended and its work is on this machine only, as the work of every agent nobody asked to publish is; publishing the work to a shared remote under the user's name should be one deliberate click, offered without being looked for, beside words that say nothing is published yet. Most often the user wants the pull request; sometimes a draft pull request, for work a person should look at before it asks for review; sometimes only the branch on the remote, with no pull request yet. And an agent that shows no control says why only when it left something the user may act on; an agent that changed nothing shows nothing, since an agent with work always shows its button.

**Problem**: opening a second pull request for a branch that already has one is the one mistake this must not make. Once a pull request exists, the bar links it and the interventions [4] feed has picked it up.

#### Business logic

Shown once the agent has ended (the caller's decision, in `AgentView.tsx`); an agent that is still working offers no next step [1], since it is still writing its branch. A subagent [5] is never offered one (above); the rules here are for every other agent. Nothing is rendered until the read of the branch has answered, and nothing while the pull request lookup is still running: acting on "not known yet" is how a second pull request gets opened. Then, the first rule that applies:

- The branch has a pull request: when it is open and the branch is not merged, a "Merge PR" button, reading "Merging…" while the merge is in flight; a merged or closed pull request, or a merged branch, offers nothing, because landed is an answer, not an action. An open pull request takes one click to land.
- The branch is gone: "Branch gone — nothing to open a PR from.", or nothing when the daemon marks it as belonging to an agent that changed nothing.
- The branch carries commits that undo each other, so its files are as the base has them, and the checkout [3] is clean: "Nothing to merge: the commits cancel out." for a repository with no remote, "Nothing to publish: the commits cancel out." otherwise, and no button. The one-line verdict counts the commits and reads "<N> commits · no change left", and the disclosure lists them.
- The branch carries no commit beyond the base: nothing when the checkout [3] holds no uncommitted files; otherwise "Nothing committed — <files> left uncommitted.", where <files> names the first two paths, joined by a comma, followed by "and <N> more" for the rest; hovering the sentence shows every path, one per line. Beside the sentence, a "Commit" button ("Asking…" while in flight) sends the agent the message "Commit your work.": the agent commits, the dashboard commits nothing, and a refusal shows in words.
- The branch carries commits and the checkout [3] still holds uncommitted files (an agent that committed, was asked for more, and left that uncommitted): "<files> left uncommitted.", named the same way, and the same "Commit" button. No merge and no publish is offered until the checkout is clean: each would be refused over the uncommitted work, and would leave the newest work behind.
- The "Commit" button tells its caller that its ask is on its way, with the ask's words, before it is sent, and tells it again that it did not go through when the daemon refuses it or the send fails; the caller shows the ask in the feed and says "Committing…" where the button was (see `AgentView.tsx`). A prompt is the button's ask when it is "Commit your work." alone, or that followed by a line break and more: the sentence a run's publish level adds.
- The branch's work is already in the project's main branch, in a repository with a remote or without one: "Merged into <main branch>." with no button. No publish step is offered, and "not published" is not said; the commit and file counts stay in the verdict. The main branch is named as the handoff's base names it, or "the main branch" when the base is a commit.
- The repository has no remote: nothing can be pushed and no pull request opened, so the one step is a merge on this machine. The branch reads "Not in <main branch> yet." and gets one button, "Merge" ("Merging…" while in flight); a refusal, a conflict among them, shows in the provider's words.
- An agent whose record says its work landed (its branch went with the merge): "Merged into the main branch.", before any other rule, with no button.
- The project has no git host package: nothing can open a pull request for it, so the last step is the push. A branch not yet on the remote reads "not published" and gets one plain button, "Publish branch", reading "Publishing…" while it is in flight; a branch already pushed gets "Pushed — no git host package to open a pull request with." and no button.
- Otherwise a split button. Its main part, "Open PR", pushes the branch and opens its pull request, ready for review, reading "Opening PR…" while that is in flight. Its second part, a down arrow labelled "Other choices", is always there and opens a menu of the other choices:
  - "Create draft PR", always: it pushes the branch and opens its pull request as a draft; the main part reads "Opening PR…" while that is in flight.
  - "Publish branch", only while the branch is not on the remote: it pushes the branch and opens no pull request; the main part reads "Publishing…" while that is in flight. Once the branch is on the remote the push alone is no choice any more, and the item is gone.

  The other choices are in the menu, never a second button beside the first: the ready pull request is what the user most often wants. While the branch is not on the remote, "not published" is said before the button: an agent publishes nothing by itself, so work still only on this machine is the usual answer and must not read as silence, and "Open PR" does not itself say that it pushes.

A reason is capped in width and truncated with an ellipsis, so a long file name never widens the row. Every button, and the arrow, is disabled while an action is in flight. A failed action reports "Could not merge the pull request.", "Could not open the pull request." or "Could not push the branch." unless the daemon answered with a more specific error, and the reason reaches the bar's summary line beside the verdict rather than nothing happening. After an action succeeds, the branch is read again so the bar shows the new state.

### The lists behind the disclosure

#### Context

**User story**: the user opens the action bar's disclosure to see what the agent [2] actually committed and changed, and what it left uncommitted.

#### Business logic

The lists show behind the disclosure of the action bar at the top of the agent's page (`AgentActionBar.tsx`). There is something to show only when the branch exists and either holds commits beyond the base or has uncommitted files in the checkout [3]; otherwise the disclosure shows nothing here. When shown, up to three lists sit side by side on a wide screen and stack on a narrow one, and a list with no rows is omitted rather than shown as a heading over nothing:

- "Commits": the first 6 commits, each as its short hash and subject, the rest as "and <N> more".
- "Changed files": the first 10 files changed against the base, each with its path and its lines added and removed, or "binary" for a binary file, the rest as "and <N> more".
- "Uncommitted files": the first 10 paths the agent changed and never committed, the rest as "and <N> more".

A truncated subject or path shows its full text on hover. The branch name is not repeated: the bar above the message box says it.
