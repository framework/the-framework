The dashboard's right sidebar beside an agent or the launcher: a small set of tabbed panels — the project's files, the documents the agent published during its work, its browser preview, and the workspace's PLAN/TODO documents — where every tab has to be earned by having something to show.

## User story

- The user wants the project's files at hand while writing a prompt, so files can be picked into the next agent's context without leaving the page.
- The user wants a document the agent published mid-work (a plan, a summary, a writeup) to surface by itself, rather than having to go looking for it.
- The user does not want a sidebar full of tabs that only say "nothing yet", and does not want the tab they are currently reading yanked away.

## Business logic — TL;DR

- **Every tab is earned by content** - Files appears only when the project has files, Views only when the agent published at least one document, Browser only when the agent is actually serving a preview, Docs only when the workspace has PLAN/TODO documents. With no tab left, the sidebar itself is not shown; with no project selected, neither is it.
- **The first published document pulls focus, nothing else does** - the rail jumps to Views the moment the agent publishes its first document. After the user picks a tab by hand, nothing overrides that pick again.
- **A sensible default until then** - with no published document, the rail sits on Files when the project has files, otherwise on Docs.
- **A tab that loses its content is not left empty** - if the active tab's content disappears, the rail falls back to the first tab that still has content.
- **Counts on the tabs** - Views carries the number of published documents; Files carries how many individual files are currently picked into the agent context.
- **Documents are read for the whole rail** - the workspace's PLAN/TODO documents are polled for the selected project, since the rail must know whether they exist before it can decide whether to offer the tab at all.

## Business logic

### Every tab is earned by content

#### User story

See `## User story`.

#### Business logic

The tabs, in this order: Files, Views, Browser, Docs. Files appears when the project reported any files. Views appears when the agent published at least one document. Browser appears only when the selected agent was started with the browser preview on and does not run on a GitHub Actions runner, where there is no browser to stream. Docs appears when the workspace has PLAN/TODO documents.

Each tab carries a hover explanation of what it holds: Files is the project's files, click one to add it to the next agent's context; Views is documents the agent pushed up during its work; Browser is a live view of the browser the agent is driving; Docs is the PLAN/TODO markdown files at the workspace root.

If no tab qualifies, the sidebar is not rendered; nor is it rendered when no project is selected.

#### Rationale

A tab that can only say "nothing yet" teaches the user that the feature is broken. This is why the browser tab is withheld unless the agent genuinely has a preview to show.

### The first published document pulls focus, nothing else does

#### User story

See `## User story`.

#### Business logic

The rail switches itself to Views the first time the agent has published a document. A second document does not switch it again, and neither does the project's file list appearing. Once the user has picked a tab by hand, the automatic default stops applying entirely — only that first-document jump can still move the rail.

Until a document has been published and while the user has not picked a tab, the rail sits on Files if the project has files and on Docs otherwise.

#### Rationale

Gates used to have a tab of their own here and a new one pulled focus; gates are now answered inline in the transcript where they were asked, so the rail has no panel for them. A committed re-narration of the agent's history had a tab too; the agents themselves are that history now.

### Counts on the tabs

#### User story

The user picks files into an agent's context from the file tree, then scrolls away. The count on the Files tab is how they check what is still selected.

#### Business logic

The Views tab shows how many documents the agent has published. The Files tab shows how many of the project's individual files are currently in the agent context; whole-repository entries that also live in that context are not counted, since they are not files in the tree.

### Documents are read for the whole rail

#### User story

See `## User story`.

#### Business logic

The workspace's PLAN/TODO documents are read for the selected project and refreshed every few seconds. The Docs tab is withheld only once the read has come back empty — while the first read is still out the tab stays, so switching projects does not blink the sidebar out and back in.

When the launcher already shows those documents in its main column, the rail withholds the Docs tab outright and skips the read, so the same panel is never shown twice at once.

### Scope of the panels

#### User story

See `## User story`.

#### Business logic

The file tree is scoped to the selected agent's own worktree, and clicking a file toggles it in the agent context shared with the launcher's start form. The browser preview is keyed to the selected agent.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
