The project panel's file tree: every file of the project's repository, as git lists them, folded into a collapsible tree, where each changed file is tinted with git's verdict for the selected agent's [2] checkout [3]. A filter box narrows the tree, hovering a file previews it, clicking a file ticks it into the Context [4] or out of it, and with no files at all the tree renders nothing.

## Context

**User story**: on a project's page the user browses the repository's files in the panel, sees at a glance which files the selected agent has changed, hovers a file to peek at its contents or its diff, and clicks the files the next agent should focus on.

## Glossary

[1] composer: the prompt editor on a project's own page, also used to say something to an agent.
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[3] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. The user's own working copy is "the project's checkout".
[4] Context: the set of paths the user picked to focus an agent on: other registered projects, by their absolute path, and files of the current project, by their path relative to the repository's root. The agent can still reach everything; the Context only says where to look.

## Business logic — TL;DR

- **A tree from the flat file list** - the paths git lists are folded into folders, folders first then files, each sorted by name; a folder opens and closes on click; with no files at all the panel renders nothing.
- **Clicking a file picks it into the Context** - a click ticks the file into the Context [4] or out of it; a picked file shows a check mark instead of the file icon and is tinted; the launcher's "Context" menu and a `#` mention in the composer [1] change the same set.
- **Git's verdict on each row** - a changed file is tinted and lettered "U", "M" or "D"; a folder with changes beneath it carries a dot in the same color, mixed changes reading as modified; the verdict is the selected agent's checkout's, re-read every 8 seconds.
- **Filtering** - "Filter files…" narrows the tree to paths containing the query and the folders leading to them, reads "<n> of <m> files", and says "No files match “<query>”." when nothing does.
- **Hover to preview** - hovering a file shows the preview card, a diff for a changed file and the contents for an unchanged one.

## Business logic

### A tree from the flat file list

#### Context

See `## Context`.

#### Business logic

The files arrive as paths relative to the repository's root, the list git keeps of the repository's files, and are folded into a tree of folders. At every level the folders come first, sorted by name, then the files, sorted by name. A folder is a native disclosure: closed until clicked (or operated from the keyboard), showing a closed-folder icon that turns into an open-folder icon while open, with its contents indented under a guide line. The tree scrolls within its own area, so a large repository does not stretch the panel past what follows it. When the project has no files at all, the tree renders nothing.

### Clicking a file picks it into the Context

#### Context

**User story**: the user browsing the tree spots the two files the next agent should work on and clicks them; the launcher's "Context" menu then lists them, and the next Start names them on the prompt's last line.

#### Business logic

Each file row shows the file's name, the last segment of its path, and is a button. Clicking it toggles the file's repository-relative path in the Context [4], which the shell owns and the launcher reads, so a file picked here, through a `#` mention in the composer [1] or removed from the launcher's "Context" menu is the same pick everywhere. A picked file's row shows a check mark in place of the file icon and is tinted in the primary color. Folders are not picked; they only open and close. Hovering a row previews the file (see below).

### Git's verdict on each row

#### Context

**Problem**: the dots must describe the selected agent's [2] checkout [3], not the project's own checkout, so they agree with the branch and the serve control in the action bar right above; and an agent editing files must show without a reload.

#### Business logic

The per-file status is read from the daemon for the selected agent's checkout, or for the project's checkout when no agent is selected, and read again every 8 seconds. A changed file's row is tinted and carries a letter on its right: green and "U" for an untracked file, amber and "M" for a modified one, red and "D" for a deleted one. Every folder on the way to a changed file carries a dot in the same color instead of a letter, since a folder only says that something beneath it changed; a folder whose changed descendants disagree reads as modified. An unchanged file has no tint and no letter.

### Filtering

#### Context

See `## Context`.

#### Business logic

A search box at the top, named "Filter files" with the placeholder "Filter files…", narrows the tree to the files whose full path contains the query, ignoring case and surrounding whitespace, together with the folders on the way to them. While a query is active a line reads "<n> of <m> files". When no file matches, the tree is replaced by "No files match “<query>”." rather than an empty pane. An empty query shows everything.

### Hover to preview

#### Context

See `## Context`.

#### Business logic

Every file row previews on hover (the card's rules in `FilePreview.tsx`): a changed file shows its diff, an unchanged one its contents, decided from the tree's own status so no second lookup is needed. The row carries no native tooltip, because the preview card already leads with the file's full path.
