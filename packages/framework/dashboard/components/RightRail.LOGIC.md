The dashboard's right rail: a narrow column beside the main pane holding up to four panels — the project's files, the views [1] the selected agent [2] pushed, a live picture of the browser that agent is driving, and the project's `PLAN`/`TODO` documents. Every panel is earned by having something in it: a panel with nothing to show is not offered as a tab, and a rail with no tab left is not drawn at all.

## Context

**User story**: while an agent [2] works, the user watches what it produces without leaving the page — the plan it wrote up, the page it is clicking through — and, before starting the next agent, ticks the files it should look at. All of that lives to the right of the conversation, one click away and never in the way.

**Problem**: a tab that can only say "nothing yet" teaches the user that the feature is broken. A rail that reorders or jumps while the user is reading it does the same. So the tabs are decided by what exists, and the rail moves the user's attention exactly once: for the first view an agent pushes.

## Glossary

[1] view: a markdown document an agent pushes to the dashboard's right rail while it works.
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[3] the agent Context: the set of other registered projects and individual files an agent is pointed at on top of its own project, carried into its system prompt.
[4] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[5] location: where an agent's turns run: `local` (this machine), `actions` (a GitHub Actions runner), or `web` (a Claude Code cloud session).
[6] relay: running an agent on a device: the local daemon forwards the start, streams the events back and forwards steering, so the agent renders like a local one.
[7] gate: a question with options at which an agent stops and waits for an answer.
[8] project home: a project's own page with the launcher (the Start form) and its composer (the prompt editor, also used for live chat).

## Business logic — TL;DR

- **Four panels, each earned by its content** - "Files", "Views", "Browser" and "Docs" appear only when there is something in them, and a rail with no panel left disappears.
- **No project, no rail** - with no project selected the rail is not drawn, and it is absent beside the full-width tickets page.
- **Which panel opens by itself** - the first view [1] an agent [2] pushes brings the rail to it; otherwise the rail rests on the files, or on the documents when there are none; once the user picks a tab by hand, nothing moves it again.
- **A panel that loses its content hands over** - when the open panel stops existing the rail falls back to the first one that still does, rather than showing an empty column.
- **The documents are read on a poll, and yield to the launcher** - the project's `PLAN`/`TODO` documents are re-read every few seconds, and are withheld entirely while the project home [8] shows them in its main column.
- **Counts on the tabs** - "Views" carries the number of views [1]; "Files" carries the number of individual files ticked into the agent Context [3].

## Business logic

### Four panels, each earned by its content

#### Context

See `## Context`.

#### Business logic

The rail offers at most four tabs, always in this order, each with a one-line explanation on hover:

- "Files" — "The project’s files — click one to add it to the next session’s context." Shown when the project has files to list. The tree is scoped to the selected agent's [2] own checkout [4] when an agent is selected, so it shows that agent's working copy rather than the user's. Clicking a file toggles it into the agent Context [3], the same set the launcher's Context picker owns.
- "Views" — "Documents the agent pushed up during the session — a plan, a summary, a writeup." Shown once the selected agent has pushed at least one view [1]. The views arrive on the agent's live event stream.
- "Browser" — "Live view of the browser this session is driving." Shown only when an agent is selected, that agent is running, and it is serving a browser screencast. It is never offered for an agent whose location [5] is `actions`: there is no browser on a GitHub Actions runner to look at, and a dead tab would teach the user the preview is broken. An agent relayed [6] to another machine or handed to a cloud session serves no screencast here either, so the tab does not appear for those.
- "Docs" — "The PLAN/TODO markdown files at the root of the workspace."

A gate [7] is answered inline in the agent's transcript, where it was asked, so the rail holds no panel for questions and never pulls attention for one. Past work is read on the agents' own pages, so the rail holds no history panel either.

### No project, no rail

#### Context

**Problem**: the rail describes one project. With none selected it has nothing to describe, and an empty column beside a full-width page is only lost space.

#### Business logic

With no project selected the rail is not drawn. It is likewise absent beside the pages that take the full width for themselves, the tickets page among them. When every tab has been ruled out by having no content, the rail is not drawn either.

### Which panel opens by itself

#### Context

**Problem**: the rail should surface what an agent [2] just produced, but must not yank the panel the user is reading. Only one thing is genuinely new enough to interrupt for: the first view [1] of an agent's work.

#### Business logic

- The moment the selected agent's first view [1] arrives, the rail switches to "Views". A second view does not: the panel the user is on stays.
- Until the user picks a tab by hand, and while there is no view, the rail rests on "Files" when the project has files and on "Docs" otherwise.
- Once the user has picked a tab, the rail stops choosing for the user. Only a first view may still move it.

### A panel that loses its content hands over

#### Context

**Problem**: content can disappear under the open panel — the last document is deleted, the selection changes — and an empty panel in an otherwise working rail reads as a fault.

#### Business logic

When the panel the rail is on no longer has a tab, the rail shows the first tab that still exists instead of an empty panel.

### The documents are read on a poll, and yield to the launcher

#### Context

**Problem**: the project home [8] already shows the `PLAN`/`TODO` documents in its main column. Repeating them in the rail beside it shows the same document twice and costs a second read of the same files.

#### Business logic

The project's `PLAN`/`TODO` documents are re-read from the daemon every four seconds while the tab may be shown. While the project home [8] renders them in its main column, the tab is withheld and the documents are not read at all.

The "Docs" tab is hidden only once the rail knows there is nothing to show: while the very first read is still out, the tab stays, so changing project does not blink the rail out and back in.

### Counts on the tabs

#### Context

**User story**: the user ticks files into the agent Context [3] and wants to see how many are ticked without opening the tree; an agent [2] pushing views [1] should say how many there are to read.

#### Business logic

- "Views" carries a badge with the number of views [1] the selected agent has pushed.
- "Files" carries a badge with the number of individual files currently ticked into the agent Context [3]. Whole projects ticked into that set are counted by the launcher's own Context picker and never here, because they are not files in this tree.
- The other tabs carry no badge, and a count of zero is not shown.
