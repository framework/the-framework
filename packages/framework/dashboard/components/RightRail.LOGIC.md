The dashboard's right rail: a narrow column beside the main pane holding up to two panels — the project's files and the project's `PLAN`/`TODO` documents. Every panel is earned by having something in it: a panel with nothing to show is not offered as a tab, and a rail with no tab left is not drawn at all.

## Context

**User story**: while an agent [1] works, the user watches the files it changed and the project's plan without leaving the page. All of that lives to the right of the conversation, one click away and never in the way.

**Problem**: a tab that can only say "nothing yet" teaches the user that the feature is broken. A rail that reorders or jumps while the user is reading it does the same. So the tabs are decided by what exists, and a tab the user picked is never taken away from them while it has content.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[3] gate: a question with options an agent's turn ended on: the agent ends waiting for the answer, the dashboard shows the question as a card, and the answer resumes the agent.
[4] project home: a project's own page with the launcher (the Start form) and its composer (the prompt editor, also used to say something to an agent).

## Business logic — TL;DR

- **Two panels, each earned by its content** - "Files" and "Docs" appear only when there is something in them, and a rail with no panel left disappears.
- **No project, no rail** - with no project selected the rail is not drawn, and it is absent beside the full-width tickets page.
- **Which panel opens by itself** - the rail rests on the files, or on the documents when there are none; once the user picks a tab by hand, nothing moves it again.
- **A panel that loses its content hands over** - when the open panel stops existing the rail falls back to the first one that still does, rather than showing an empty column.
- **The documents are read on a poll, and yield to the launcher** - the project's `PLAN`/`TODO` documents are re-read every few seconds, and are withheld entirely while the project home [4] shows them in its main column.

## Business logic

### Two panels, each earned by its content

#### Context

See `## Context`.

#### Business logic

The rail offers at most two tabs, always in this order, each with a one-line explanation on hover:

- "Files" — "The project’s files, with what the session changed — hover one to preview it." Shown when the project has files to list. The tree is scoped to the selected agent's [1] own checkout [2] when an agent is selected, so it shows that agent's working copy rather than the user's.
- "Docs" — "The PLAN/TODO markdown files at the root of the workspace."

A gate [3] is answered inline in the agent's transcript, where it was asked, so the rail holds no panel for questions and never pulls attention for one. Past work is read on the agents' own pages, so the rail holds no history panel either. No tab carries a count.

### No project, no rail

#### Context

**Problem**: the rail describes one project. With none selected it has nothing to describe, and an empty column beside a full-width page is only lost space.

#### Business logic

With no project selected the rail is not drawn. It is likewise absent beside the pages that take the full width for themselves, the tickets page among them. When every tab has been ruled out by having no content, the rail is not drawn either.

### Which panel opens by itself

#### Context

**Problem**: the rail must not yank the panel the user is reading.

#### Business logic

- Until the user picks a tab by hand, the rail rests on "Files" when the project has files and on "Docs" otherwise, following the files as they appear or go.
- Once the user has picked a tab, the rail stops choosing for the user.

### A panel that loses its content hands over

#### Context

**Problem**: content can disappear under the open panel — the last document is deleted, the selection changes — and an empty panel in an otherwise working rail reads as a fault.

#### Business logic

When the panel the rail is on no longer has a tab, the rail shows the first tab that still exists instead of an empty panel.

### The documents are read on a poll, and yield to the launcher

#### Context

**Problem**: the project home [4] already shows the `PLAN`/`TODO` documents in its main column. Repeating them in the rail beside it shows the same document twice and costs a second read of the same files.

#### Business logic

The project's `PLAN`/`TODO` documents are re-read from the daemon every four seconds while the tab may be shown. While the project home [4] renders them in its main column, the tab is withheld and the documents are not read at all.

The "Docs" tab is hidden only once the rail knows there is nothing to show: while the very first read is still out, the tab stays, so changing project does not blink the rail out and back in.
