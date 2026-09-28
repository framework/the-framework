The dashboard's right rail: a narrow column beside the main pane holding the tabs the installed modules [10] add for the project (the Files module's "Files" tab first of all), then the views [1] the selected agent [2] pushed, and the project's `PLAN`/`TODO` documents. A module's tab is always offered where the project has the module; the rail's own two panels are earned by having something in them, and a rail with no tab left is not drawn at all.

## Context

**User story**: while an agent [2] works, the user watches what it produces without leaving the page — the plan it wrote up, the files it changed. All of that lives to the right of the conversation, one click away and never in the way. On a project's home the Files tab is where the user clicks the files the next agent should focus on.

**Problem**: a tab that can only say "nothing yet" teaches the user that the feature is broken. A rail that reorders or jumps while the user is reading it does the same. So the rail's own tabs are decided by what exists, and the rail moves the user's attention exactly once: for the first view an agent pushes. A module's tab cannot be judged empty without drawing it, so it is offered and says itself, in one line, when it has nothing.

## Glossary

[1] view: a markdown document an agent pushes to the dashboard's right rail while it works.
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[7] gate: a question with options an agent's turn ended on: the agent ends waiting for the answer, the dashboard shows the question as a card, and the answer resumes the agent.
[8] project home: a project's own page with the launcher (the Start form) and its composer (the prompt editor, also used to say something to an agent).
[9] Context: the set of paths the user picked to focus an agent on: other registered projects, by their absolute path, and files of the current project, by their path relative to the repository's root. The agent can still reach everything; the Context only says where to look.
[10] module: a package that adds to the dashboard (pages, Overview cards, side-rail tabs, what an agent's page shows, actions on the links pages show): its browser part, named by the package's `exports["./dashboard"]`, reads its data through its own package's command, or through its own server part, named by `exports["./server"]`, which the daemon calls in its own process. A module comes from a project's dependencies, or is built into the dashboard and loaded for every project, as the Files module is.

## Business logic — TL;DR

- **The modules' tabs first, then the rail's own two** - every tab an installed module [10] adds for the project comes first, in package order, always offered; then "Views" and "Docs", each only when there is something in it; a rail with no tab left disappears.
- **What a module's tab is given** - the project, the selected agent [2] when there is one, and the Context's [9] files with a way to add or remove one; a tab that throws shows its own error line and leaves the rest of the rail standing.
- **No project, no rail** - with no project selected the rail is not drawn, and it is absent beside a full-width module page.
- **Which panel opens by itself** - the first view [1] an agent [2] pushes brings the rail to it; otherwise the rail rests on the first module's tab, or on the documents when there is none; once the user picks a tab by hand, nothing moves it again.
- **A panel that loses its content hands over** - when the open panel stops existing the rail falls back to the first one that still does, rather than showing an empty column.
- **The documents are read on a poll, and yield to the launcher** - the project's `PLAN`/`TODO` documents are re-read every few seconds, and are withheld entirely while the project home [8] shows them in its main column.
- **Counts on the tabs** - "Views" carries the number of views [1], and a module's tab the count it asks for (the Files tab: the Context's files); "Docs" carries none.

## Business logic

### The modules' tabs first, then the rail's own two

#### Context

See `## Context`.

#### Business logic

The rail offers, in this order, each with its one-line explanation on hover:

- Every tab an installed module [10] adds (`lib/use-modules.ts`), for a project that has that module, in package order: its label and its explanation are the module's. The built-in Files module adds "Files" — "The project’s files, or a session’s with what it changed, for as long as its checkout, branch or merge commit exists — hover one to preview it, click one to add it to the next run’s Context." A module's tab is offered on the project's home and on every agent's page, whatever it holds: when it has nothing, it says so inside.
- "Views" — "Documents the agent pushed up during the session — a plan, a summary, a writeup." Shown once the selected agent has pushed at least one view [1]. The views arrive on the agent's live event stream.
- "Docs" — "The PLAN/TODO markdown files at the root of the workspace."

A gate [7] is answered inline in the agent's transcript, where it was asked, so the rail holds no panel for questions and never pulls attention for one. Past work is read on the agents' own pages, so the rail holds no history panel either.

### What a module's tab is given

#### Context

**User story**: the user clicks a file in the Files tab, and the launcher's "Context" menu then lists it; the same file shows ticked in the tab.

#### Business logic

The open module tab is drawn in its module's own slot: inside the services the dashboard gives modules, bound to that module's package, and inside a boundary, so a tab that throws shows "The <label> tab failed: <reason>" in its place and nothing else of the rail breaks. It is given the project, the selected agent's id on an agent's page, and the Context [9] as a module sees it: the Context's files only, the project's listed files that are in it, never the other projects' paths the launcher's checkboxes also put there; and the toggle that adds a path to the Context or takes it out, which the shell owns and the launcher reads.

### No project, no rail

#### Context

**Problem**: the rail describes one project. With none selected it has nothing to describe, and an empty column beside a full-width page is only lost space.

#### Business logic

With no project selected the rail is not drawn. It is likewise absent beside the pages that take the full width for themselves, a module's page among them. When no module adds a tab for the project and the rail's own tabs have been ruled out by having no content, the rail is not drawn either.

### Which panel opens by itself

#### Context

**Problem**: the rail should surface what an agent [2] just produced, but must not yank the panel the user is reading. Only one thing is genuinely new enough to interrupt for: the first view [1] of an agent's work.

#### Business logic

- The moment the selected agent's first view [1] arrives, the rail switches to "Views". A second view does not: the panel the user is on stays.
- Until the user picks a tab by hand, and while there is no view, the rail rests on the first module tab when there is one and on "Docs" otherwise.
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

**User story**: an agent [2] pushing views [1] should say how many there are to read; files picked into the Context [9] should be counted where they were picked.

#### Business logic

- "Views" carries a badge with the number of views [1] the selected agent has pushed.
- A module's tab carries the count the module asks for, from what the tab is given. The Files tab's is the number of the Context's files; the other projects' paths the launcher put in the Context are not counted.
- "Docs" carries no badge, and a count of zero is not shown.
