The Files tab the Files module [5] adds to the side rail: every file of the project's repository, as git lists them, folded into a collapsible tree, where each changed file is tinted with git's verdict. With an agent [2] selected, the tree is that agent's own: read from its checkout [3] while it exists, then from its branch, then from the commit its pull request merged as, or, for a subagent its main agent landed, from the last commit its record kept, with the files it changed marked while its work is not merged yet, and a plain tree once it is; an agent that finished `done` or `failed` on this machine with no checkout, no branch and no pull request left changed nothing and shows the project's default branch with nothing marked, and any other agent says in one line that its changes are gone once none of those is left. A filter box narrows the tree, hovering a file previews it, clicking a file ticks it into the Context [4] or out of it, and with no files at all the tab says so in one line.

## Context

**User story**: on a project's page the user browses the repository's files in the side rail's Files tab, sees at a glance which files the selected agent has changed, hovers a file to peek at its contents or its diff, and clicks the files the next agent should focus on.

**User story**: the user opens a run that finished yesterday to see what it changed. Its checkout [3] was reclaimed long ago, but its branch, or the commit its pull request merged as, still holds the change, so the tree shows it, and says where it read it from.

**User story**: the user reads the marks as "waiting": work that is not merged yet. Once an agent's work is merged its tree is plain and says so, and what the agent changed is in the Changes tab (`ChangesPanel.tsx`).

## Glossary

[1] composer: the prompt editor on a project's own page, also used to say something to an agent.
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[3] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. The user's own working copy is "the project's checkout".
[4] Context: the set of paths the user picked to focus an agent on: other registered projects, by their absolute path, and files of the current project, by their path relative to the repository's root. The agent can still reach everything; the Context only says where to look. The dashboard hands the tab the Context's files only, with a way to add or remove one.
[5] module: a package that adds to the dashboard (pages, Overview cards, side-rail tabs, what an agent's page shows, actions on the links pages show, Settings sections): its browser part, named by the package's `exports["./dashboard"]`, reads its data through its own package's command, or through its own server part, named by `exports["./server"]`, which the daemon calls in its own process. A module comes from a project's dependencies, or is built into the dashboard and loaded for every project, as the Files module is.

## Business logic — TL;DR

- **A tree from the flat file list** - the paths git lists are folded into folders, folders first then files, each sorted by name; a folder opens and closes on click, and its contents exist on the page only while it is open; "Reading the project’s files…" until the project's first read answers, and "No files here." when there are none.
- **Clicking a file picks it into the Context** - a click ticks the file into the Context [4] or out of it; a picked file shows a check mark instead of the file icon and is tinted; the launcher's "Context" menu and a `#` mention in the composer [1] change the same set, and the tab's label counts the Context's files.
- **Git's verdict on each row** - a changed file is tinted and lettered "U", "A", "M" or "D", followed by a solid dot when the change is committed and a ring when it is only on disk; a folder with changes beneath it carries a dot in the same color, mixed changes reading as modified; re-read every 8 seconds.
- **An agent's own tree, for as long as git has it** - with an agent [2] selected, the tree and its marks are the agent's, read from its checkout [3], then its branch, then its merge commit, then, for a landed subagent, its last commit, with a caption naming which; once all the agent changed is merged, nothing marked, captioned "Merged: nothing waiting. What it changed is under Changes."; the default branch with nothing marked, captioned "This run changed no files", for an agent that finished `done` or `failed` on this machine and changed nothing; "Looking for this run’s changes…" while that is not known yet, and one line saying the changes are gone when none is left otherwise.
- **Filtering** - "Filter files…" narrows the tree to paths containing the query and the folders leading to them, reads "<n> of <m> files", and says "No files match “<query>”." when nothing does.
- **Hover to preview** - hovering a file shows the preview card, a diff for a changed file and the contents for an unchanged one.

## Business logic

### A tree from the flat file list

#### Context

See `## Context`.

#### Business logic

The files arrive from the module's own server part as paths relative to the repository's root, the list git keeps of the repository's files (tracked and untracked, honoring the ignore rules), and are folded into a tree of folders. At every level the folders come first, sorted by name, then the files, sorted by name. A folder is a native disclosure: closed until clicked (or operated from the keyboard), showing a closed-folder icon that turns into an open-folder icon while open, with its contents indented under a guide line. A folder's contents are put on the page when it opens and taken off when it closes, so the tab holds only the rows of the top level and of the open folders: a repository of thousands of files opens as fast as a small one, and the 8-second re-reads re-draw only those rows. A folder stays open or closed across those re-reads. The tree scrolls within its own area, so a large repository does not stretch the rail past what follows it. Until the project's first read answers, the tab reads "Reading the project’s files…"; when the project has no files at all, it reads "No files here."

### Clicking a file picks it into the Context

#### Context

**User story**: the user browsing the tree spots the two files the next agent should work on and clicks them; the launcher's "Context" menu then lists them, and the next Start names them on the prompt's last line.

#### Business logic

Each file row shows the file's name, the last segment of its path, and is a button. Clicking it toggles the file's repository-relative path in the Context [4], which the dashboard owns and the launcher reads, so a file picked here, through a `#` mention in the composer [1] or removed from the launcher's "Context" menu is the same pick everywhere. A picked file's row shows a check mark in place of the file icon and is tinted in the primary color. Folders are not picked; they only open and close. Hovering a row previews the file (see below).

### Git's verdict on each row

#### Context

**Problem**: the marks must describe the selected agent's [2] work, not the project's own checkout, so they agree with the branch and the serve control in the action bar right above; and an agent editing files must show without a reload.

#### Business logic

With no agent selected, the project's files and the per-file status of the project's checkout are read together, in one read of the module's server part, and read again every 8 seconds; every change there is uncommitted. With an agent selected, the marks come with the agent's own tree (see below). A changed file's row is tinted and carries a letter on its right: green and "U" for an untracked file, green and "A" for a file a commit added, amber and "M" for a modified one, red and "D" for a deleted one. After the letter, a solid dot says the change is committed and a hollow ring says it is only on disk, not committed yet. Every folder on the way to a changed file carries a dot in the same color instead of a letter, since a folder only says that something beneath it changed; a folder whose changed descendants disagree reads as modified. An unchanged file has no tint and no letter.

### An agent's own tree, for as long as git has it

#### Context

**Problem**: an agent's checkout [3] is reclaimed after it finishes. Showing the project's own checkout unmarked in its place reads as "this agent touched nothing", or as a bug, while its change is still in git.

#### Business logic

With an agent [2] selected, the tree is read for that agent from the module's server part, and read again every 8 seconds, and a moment (300 ms) after each new event in the agent's feed, since the agent may have just changed a file; a burst of events is one read (the source rules in `src/tree.ts`). The answer is the list of files and the marks together, from one place:

- its checkout, while it exists: captioned "From the run’s checkout";
- else its branch, on this machine or origin's copy of it: captioned "From branch <branch>";
- else the commit its pull request merged as: captioned "From the merge of #<number>";
- else, for an agent whose work was landed (a subagent's merged into its main agent's branch, or an agent's merged into the project's main branch by the user, the agent's own branch deleted either way), the last commit its record kept: captioned "From its last commit: its work was merged, and its branch is gone";
- else, when it finished `done`, `failed` or `stopped` on this machine (its record names this machine and one of those statuses) and has no branch left and no pull request, it changed nothing, because it recorded its branch's last name as it ended and on this machine that branch was deleted with its checkout only once the remote had everything on it: the project's default branch, nothing marked, captioned "This run changed no files". An agent from another machine is never read so, since its branch may simply not be on this one.

When the answer says the agent's work is merged (the agent changed something, all of it is merged and nothing is left uncommitted; the rule is `src/tree.ts`'s), the tree marks no file and no folder, whatever the answer names as changed, and the caption reads "Merged: nothing waiting. What it changed is under Changes." in place of the source's caption. The marks say what is not merged yet, so merged work has none; hovering a file of that tree shows its contents.

The caption sits above the tree. While the agent is starting on this machine (no checkout yet), the tab shows the project's files with nothing marked, captioned "Starting from the project’s files": its checkout is made from them. Until the first answer arrives, while an agent running on another machine has no branch here, or while the agent's pull request is still being looked up, the tab reads "Looking for this run’s changes…". When an agent whose tree the tab showed answers pending (its checkout reclaimed as it ends, its branch not read yet), the tab keeps showing the tree it had until the new place answers, rather than "Looking…" or an empty list. In both waits it reads again every 2 seconds rather than every 8, so the agent's own tree shows as soon as its checkout is made. Otherwise, when none of those places is left on this machine, the tab reads "This run’s changes are gone from this machine: its checkout was reclaimed and it left no branch or merged pull request here." instead of any tree. The project's own file list is not used for an agent.

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
