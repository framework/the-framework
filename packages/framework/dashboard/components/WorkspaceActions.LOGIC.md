The row of buttons for reaching a checkout [1] outside the browser: open the project's repository on GitHub, open the checkout in the operating system's file manager, and open it in the user's editor — plus the choice of which editor that is. The same row serves a project's own page and an agent's [2] page: on a project's page the buttons act on the project's checkout, and on an agent's page every one of them acts on that agent's own checkout instead.

## Context

**User story**: the user watching an agent [2] wants to look at what it is writing with their own tools — the folder, their editor — without first working out where that agent's checkout is on disk. The whole point of giving each agent its own checkout is that it can be opened like any other working copy.

**Problem**: an agent's page that offered no way out to the file system sent the user back to the project's page, where opening "the project" showed the code the agent did not write.

## Glossary

[1] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. The user's own working copy is "the project's checkout".
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[3] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).

## Business logic — TL;DR

- **The repository on GitHub** - one link to the project's repository, shown only when the project has a GitHub address.
- **The folder and the editor** - two buttons opening this checkout on the user's machine, naming whose checkout they mean.
- **Which editor** - the editor menu also carries the choice of editor, stored in the preferences.
- **When opening fails** - the reason is shown beside the buttons, and never carries over to another checkout.

## Business logic

### The repository on GitHub

#### Context

**Problem**: an agent's [2] branch may not be pushed anywhere yet, so there is no branch page to link to. The repository is the same one either way.

#### Business logic

A GitHub icon links to the project's repository, opening in a new tab, with the tooltip "Open on GitHub". It is shown only when the daemon can name a GitHub address for the project; a project with no GitHub remote simply has no such button. The link is the project's repository on both pages, since an agent works a branch of that same repository. A pull request an agent opened is shown by the agent's own git status, not here.

### The folder and the editor

#### Context

See `## Context`.

#### Business logic

Two buttons, each acting on the checkout [1] this row is about — the project's, or the agent's [2] when the row sits on an agent's page:
- A folder button opening the checkout in the operating system's file manager, with the tooltip "Open this agent's folder (Finder / Explorer)" on an agent's page and "Open folder (Finder / Explorer)" on a project's page.
- An editor button, labeled "Open in editor", opening a menu whose first row opens the checkout in the user's editor: "Open this agent's checkout" on an agent's page, "Open in your editor" on a project's page.

Both are disabled while an open is in flight.

### Which editor

#### Context

**User story**: the user has one editor they work in and expects "Open in editor" to use it, without editing a settings page every time.

#### Business logic

Under the editor menu's open row sits the choice of which editor is used, described in `PreferredEditorItems.tsx`: the detected editors, the current choice marked, and the pick stored in the preferences [3].

### When opening fails

#### Context

**Problem**: a failure that stays on screen after the user switches to another agent [2] or another project reads as that checkout's [1] failure.

#### Business logic

When the daemon cannot open the folder or the editor, "Failed to open." — or the reason the daemon gives — appears in red beside the buttons. Switching to another project or another agent clears it at once, so a message always belongs to the checkout the row is currently about.
