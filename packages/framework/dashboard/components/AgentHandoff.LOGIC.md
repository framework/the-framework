What an agent [2] left behind, as the user meets it in the agent's action bar: a one-line verdict of what the agent's branch holds, the next step offered as a button once the agent has ended (or the reason there is nothing to press), and the commits and files the bar expands to. The verdict and the next step ride in the bar beside the branch they are about; the lists are behind the bar's disclosure.

## Context

**User story**: an agent finishes and the user asks "what did it leave, and what do I do now?". The bar answers both in one line and offers the one step that moves the work forward, without the user leaving the dashboard for the command line, and without ever offering a button that GitHub can only refuse.

**Problem**: what the branch holds is read by branch name, not from the agent's checkout [3], because a clean agent's checkout is removed when it ends; the branch survives it.

## Glossary

[1] next step: what a person can do with an ended agent's work from the dashboard: open a pull request for its branch, or merge the pull request it has; on a project with no forge package, push the branch.
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps. An agent publishes its own work — pushes its branch, opens its pull request — when its command says to.
[3] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[4] intervention: something that needs a human — an open question, a pull request to review, unpushed commits — one of the two notification feeds.

## Business logic — TL;DR

- **The one-line verdict** - what the branch holds, in a phrase: "branch gone", "merged", "no changes", or the commit and file counts with the lines added and removed, plus "pushed" when the branch is on the remote and has no pull request.
- **The next step, or why there is none** - once the agent has stopped: "Open PR", or "Merge PR" for an open pull request, or "Push" where the project has no forge package, or one sentence saying why nothing can be pressed; never a button the forge would refuse, and nothing at all while the pull request lookup is still out.
- **The lists behind the disclosure** - the commits (up to 6), the changed files (up to 10) and the uncommitted files (up to 10), the rest counted as "and N more"; shown only when there is something to list.

## Business logic

### The one-line verdict

#### Context

See `## Context`.

#### Business logic

Nothing is shown until the read of the branch has answered. Then, in the bar, muted:

- "branch gone" when the branch no longer exists (deleted, or never created). A gone branch and a never-pushed branch are different facts and the verdict tells them apart.
- When the branch carries no commit the base branch does not already have: "merged" when the branch is merged into the base, otherwise "no changes". A merged branch also reads as empty, since all its commits are on the base, but "merged" and "no changes" are opposite verdicts and only one of them is true.
- Otherwise the counts: "<N> commit" or "<N> commits", a middle dot, "<N> file" or "<N> files", and the lines added and removed. When the branch is on the remote at the same commit and no pull request is linked to it, "· pushed" follows: whether the work is on the remote is the first question about its next step [1]. The pull request itself is not repeated here, because the bar already links it.

### The next step, or why there is none

#### Context

**User story**: an agent [2] has ended without publishing its own work, because its command did not say to or because the attempt failed; publishing the work to a shared remote under the user's name should be one deliberate click, offered without being looked for. And an agent that shows no control must say why, since "what should I do now?" is exactly what the user came for.

**Problem**: opening a second pull request for a branch that already has one is the one mistake this must not make. Once a pull request exists, the bar links it and the interventions [4] feed has picked it up.

#### Business logic

Shown once the agent has ended (the caller's decision, in `AgentView.tsx`); an agent that is still working offers no next step [1], since it publishes its own work. Nothing is rendered until the read of the branch has answered, and nothing while the pull request lookup is still running: acting on "not known yet" is how a second pull request gets opened. Then, the first rule that applies:

- The branch has a pull request: when it is open and the branch is not merged, a "Merge PR" button, reading "Merging…" while the merge is in flight; a merged or closed pull request, or a merged branch, offers nothing, because landed is an answer, not an action. An agent opens its pull request and leaves the merge to a person: it takes one click to land.
- The branch is gone: "Branch gone — nothing to open a PR from."
- The branch carries no commit beyond the base: "Nothing committed — no PR to open." when the checkout [3] holds no uncommitted files; otherwise "Nothing committed — <files> left uncommitted.", where <files> names the first two paths, joined by a comma, followed by "and <N> more" for the rest; hovering the sentence shows every path, one per line. No button: GitHub would refuse a pull request with no commits, and the named work is what the user's next message to the agent should have it commit.
- The repository has no remote: "No remote to push to."
- The project has no forge package: nothing can open a pull request for it, so the last step is the push. A branch not yet on the remote gets one button, "Push", reading "Pushing…" while it is in flight; a branch already pushed gets "Pushed — no forge package to open a pull request with." and no button.
- Otherwise one button, "Open PR", reading "Opening PR…" while it is in flight. Opening a pull request pushes the branch on the way, so no separate push button competes with it.

A reason is capped in width and truncated with an ellipsis, so a long file name never widens the row. Both buttons are disabled while an action is in flight. A failed action reports "Could not merge the pull request.", "Could not open the pull request." or "Could not push the branch." unless the daemon answered with a more specific error, and the reason reaches the bar's summary line beside the verdict rather than nothing happening. After an action succeeds, the branch is read again so the bar shows the new state.

### The lists behind the disclosure

#### Context

**User story**: the user opens the bar's disclosure to see what the agent [2] actually committed and changed, and what it left uncommitted.

#### Business logic

The bar is worth expanding only when the branch exists and either holds commits beyond the base or has uncommitted files in the checkout [3]; otherwise the disclosure shows nothing here. When shown, up to three lists sit side by side on a wide screen and stack on a narrow one, and a list with no rows is omitted rather than shown as a heading over nothing:

- "Commits": the first 6 commits, each as its short hash and subject, the rest as "and <N> more".
- "Changed files": the first 10 files changed against the base, each with its path and its lines added and removed, or "binary" for a binary file, the rest as "and <N> more".
- "Uncommitted files": the first 10 paths the agent changed and never committed, the rest as "and <N> more".

A truncated subject or path shows its full text on hover. The branch name is not repeated: the bar the lists hang from already says it.
