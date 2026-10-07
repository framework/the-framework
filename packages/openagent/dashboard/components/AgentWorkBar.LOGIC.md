The bar above the message box of an agent's [1] page: one row saying where the agent's work is (the project, the agent's branch), what the branch holds, the branch's pull request, and, at the end, the next step [2] as a button, or the words that stand in its place. The bar is there while there is something to say about the agent's work.

## Context

**User story**: the user finished reading the agent's last message and is about to type. Right above the box they type in, as Claude Code on the web has it, one row says which project and which branch the work is on, how much the branch holds ("2 commits · 3 files +40 −2"), and offers the one thing to do with it: "Commit", "Open PR", "Publish branch", "Merge" or "Merge PR". The user does not scroll back to the top of the page to find the button.

**User story**: an agent that changed nothing has no bar: a row with nothing to say about the work is in the way of the message box. The bar comes when there is something to say, and the message box moves by the bar's height then; that is accepted.

**Business logic story**: the bar reads nothing itself. The agent's page reads the agent's checkout [3] once and hands it to this bar and to the action bar at the top of the page (`AgentView.tsx`); the page also decides what the summary and the next step are, hands them in as the bar's two slots, and says whether there is something to say.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] next step: what a person can do with an ended agent's work from the dashboard: open a pull request for its branch, or merge the pull request it has.
[3] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.

## Business logic — TL;DR

- **When the bar is there** - only while the agent's branch is known and the page says there is something to say: the agent has changes, a pull request or a next step [2]; otherwise nothing is drawn.
- **One row, one height** - the row never wraps and never changes height, with a next step or without one.
- **What the row says** - the project's name, the branch, what the branch holds, the pull request link, and at the far end the next step [2] or the words in its place.
- **What gives up width** - the branch alone is cut with an ellipsis; the project's name is capped; the rest keeps its width.

## Business logic

### When the bar is there

#### Context

See the second user story in `## Context`.

#### Business logic

The bar is drawn only while both hold:

- the agent's checkout [3], as the page read it, names a branch. Until that read has answered, and for an agent whose answer names no branch, nothing is drawn;
- the page says there is something to say. The page decides this (`AgentView.tsx`: the agent has changes, a pull request, or a next step [2]); the bar does not look into its slots.

With nothing to say nothing is drawn: no empty row, and neither the summary nor the next step the page handed in is shown.

### One row, one height

#### Context

See the first user story in `## Context`.

#### Business logic

The bar is one bordered row with round corners, 2.25rem high, centered at the transcript's column width (48rem at most), right above the message box. Its height is fixed: it is the same with a button at its end, with words there, and with nothing there. Content that does not fit is cut off at the row's edge; the row never wraps to a second line. The row is named "This agent's work" for assistive technology.

### What the row says

#### Context

See the first user story in `## Context`.

#### Business logic

From left to right:

- the project's name, in grey, when the page gives one;
- a branch icon and the agent's branch, in grey, as it is named. The tooltip shows the branch again, never cut short, and, while the agent has its checkout [3], the checkout's path on a second line;
- the summary: what the branch holds, as the page words it (`AgentView.tsx`). For an ended agent it is the one-line verdict, such as "2 commits · 3 files" with the lines added and removed (`AgentHandoff.tsx`);
- when the branch has a pull request: a link reading "PR #<number>" followed by the pull request's state in lowercase inside a small pill ("open", "merged", "closed"). It opens the pull request in a new tab and shows the pull request's title in its tooltip;
- at the far end, the page's next step [2] slot: a button ("Commit", "Open PR" with its arrow, "Publish branch", "Merge", "Merge PR"), or the words that stand where the button would be ("Committing…", "not published", "Merged into main.", and the other sentences of `AgentHandoff.tsx`). The slot is empty while the agent works.

### What gives up width

#### Context

**Problem**: a half-cut "2 commits · 3 fi" does not read, and a button pushed out of the row cannot be pressed. A branch name cut with an ellipsis still reads.

#### Business logic

The branch is the one part that gives up width: on a narrow row it is cut with an ellipsis, and its tooltip still says it whole. The project's name keeps its width up to a cap of 8rem; a longer name is cut there with an ellipsis and shown whole on hover. The summary, the pull request link and the next step keep their width.
