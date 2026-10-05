The Changes tab the Files module [4] adds to the side rail: only the files that changed, as a list on the left, and on the right the diff of the one file picked in the list. With an agent [1] selected, the list is what that agent changed, read from wherever its files are now, and kept once its work is merged; under it are the agent's commits, and a click on one shows that commit alone. With no agent selected, the list is the files changed in the project's checkout [2] and not committed. With nothing changed, the tab says so in one line.

## Context

**User story**: the user opens an agent's page to see what the agent did, without walking the whole tree: the Changes tab lists the changed files alone, on the left, and shows the first file's diff beside the list at once, as Claude Code on the web does; a click on another file shows that file's diff.

**User story**: the user merged an agent's work last week. The Files tab's tree is plain now, since its marks say what is not merged yet. The Changes tab still lists what that agent changed, and says it is merged.

**User story**: the user wants to follow the agent's work step by step. Under the list of files are the agent's commits, newest first; a click on one shows the files that commit changed and its own diff, and "All changes" goes back to everything the agent changed.

**User story**: on the project's own page, the user sees which files of the project's folder are changed and not committed.

**User story**: at the end of a turn, the agent's chat lists the files the turn's edits changed, a row each. The user clicks one: the side rail opens on the Changes tab with that file picked, and its diff beside the list.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. The user's own working copy is "the project's checkout".
[3] mark: what happened to a changed file, added, untracked, modified or deleted, and whether the change is committed or only on disk.
[4] module: a package that adds to the dashboard (pages, Overview cards, side-rail tabs, what an agent's page shows, actions on the links pages show, Settings sections): its browser part, named by the package's `exports["./dashboard"]`, reads its data through its own package's command, or through its own server part, named by `exports["./server"]`, which the daemon calls in its own process. A module comes from a project's dependencies, or is built into the dashboard and loaded for every project, as the Files module is.

## Business logic — TL;DR

- **An agent's changes** - with an agent [1] selected, every file the agent changed, sorted by path, under a caption saying whether the work is merged; "This run changed no files." when there is none and the agent has no commit; "Looking for this run’s changes…" while that is not known yet, and one line saying the changes are gone when no source is left.
- **The project folder's changes** - with no agent selected, every file changed in the project's checkout [2] and not committed, or "Nothing is changed in the project’s folder."
- **One row per file** - in a column on the left: the file's path and, under it, "new", "modified" or "deleted", with "· not committed" for a change that is only on disk; a click picks the file.
- **The commits** - on an agent's page, under the list of files: "All changes", picked at first, then one row per commit of the agent's work, newest first; a click on a commit shows that commit alone: its files in the list, its own diff on the right, and its short id and subject where the caption was.
- **The picked file's diff** - on the right of the list, the diff of one file: the file the user clicked, or the first of the list while none was clicked or once the clicked file has left the list; only that file's diff is read.
- **A file asked for from the chat** - the file a click in the agent's chat asked to see is picked as a click on its row in "All changes" is, once per ask: a picked commit gives way, a click made in the list afterwards stands, a file named by its whole path on disk is the listed file that path ends with, and a file the list does not hold leaves the first file picked.

## Business logic

### An agent's changes

#### Context

**Problem**: the Files tab marks an agent's changes only while they are not merged. Without a second place, what a merged agent changed would be shown nowhere.

#### Business logic

With an agent [1] selected, the tab reads the agent's tree from the module's server part, the same read the Files tab makes (the source rules in `src/tree.ts`), every 8 seconds, and a moment (300 ms) after each new event in the agent's feed, since the agent may have just changed a file; a burst of events is one read. Of the answer it uses the changed files and their marks [3], and whether the agent's work is merged; the tree of all files is not shown.

- The list holds every changed file, sorted by path, a deleted file included.
- A caption above the list reads "What this run changed. Merged." when the answer says the agent's work is merged, and "What this run changed. Not merged yet." otherwise.
- When the answer names no changed file and the agent has no commit, the tab reads "This run changed no files." When it names none but the agent has commits (they undo each other), the tab is drawn with an empty list and the commits, and the place of the diff reads "No change is left: the commits cancel out."
- Until the first answer arrives, and while the answer is pending, the tab reads "Looking for this run’s changes…". When an agent whose list the tab showed answers pending (its checkout reclaimed as it ends, its branch not read yet), the tab keeps showing the list it had.
- What the tab last read is remembered under names it shares with the Files tab (`keys.ts`): opened again for the same agent, or after the Files tab read the same agent, it shows that at once while it reads again, with no "Looking for this run’s changes…" in between. An agent never read still shows the line until its own answer.
- When none of the agent's sources is left on this machine, the tab reads "This run’s changes are gone from this machine: its checkout was reclaimed and it left no branch or merged pull request here."

The project's own files are not read for an agent.

### The project folder's changes

#### Context

See `## Context`.

#### Business logic

With no agent selected, the tab reads the project's files and the status of the project's checkout [2] from the module's server part, the read the Files tab makes there, every 8 seconds, and lists the changed files, sorted by path; every change there is uncommitted. The caption reads "Changed in the project’s folder, not committed." Until the first read answers, the tab reads "Reading the project’s files…"; when nothing is changed, "Nothing is changed in the project’s folder." No agent's tree is read, and no commits are read or shown.

### One row per file

#### Context

**Problem**: a diff is a git read. Reading every changed file's diff to draw the list would cost one read per file on every poll.

#### Business logic

The left column of the tab, under the caption, is a third of the tab's width and never over 14rem or under 8rem. The list, named "Changed files", is at its top, takes the height the commits (below) leave, and scrolls by itself. Each row is a button showing the file's path on one line, its folders dimmed and its name struck through when the file was deleted, cut with an ellipsis when it does not fit and shown whole on hover. Under the path, in small letters, is what happened to the file: "new" in green for an added or untracked file, "modified" in amber, "deleted" in red, in capitals. A change that is only on disk, not committed, reads "· not committed" after it. Clicking a row picks its file; the picked row is highlighted.

### The commits

#### Context

See the user story on commits in `## Context`.

**Problem**: the agent may rewrite its commits while the user looks at one (an amend, a rebase). A commit that is no longer the agent's must not stay on screen as if it were.

#### Business logic

The panel says nothing about the run's files before the commits are read too: "Looking for this run’s changes…" stays until both reads have answered, so "This run changed no files." never shows for a moment over a run whose commits cancel out. While the run's files move as it ends (the tree read answers pending), the commits last read stay, and so does a picked commit. One commit never changes, so its files are read again only once a minute.

With an agent [1] selected, the tab reads the commits of the agent's work from the module's server part (the rules in `src/tree.ts`: newest first, 200 at most, uncommitted work in none), every 8 seconds, and together with the tree a moment after each new event in the agent's feed. With no agent selected nothing is read.

When the agent has at least one commit, a section named "Commits" sits at the bottom of the left column, under the list of files. It shows the word "Commits" and the number of commits, then its rows; it takes at most 45% of the column's height and scrolls by itself. An agent with no commit has no such section. The rows:

- "All changes", first, picked until the user clicks a commit, and again when a file is asked for from the chat (see "A file asked for from the chat");
- one row per commit, newest first: the commit's subject, cut with an ellipsis and shown whole on hover, and under it the short id, the author's name and how long ago it was committed ("bbbbbbb · Agent · 2h ago").

A click on a commit picks it, and the tab then shows that commit alone:

- the caption reads "<short id> <subject>", cut with an ellipsis and shown whole on hover, in place of "What this run changed. …";
- the list of files holds the files that commit changed, read from the module's server part when the commit is picked and again every 8 seconds, sorted by path, with the same rows;
- the diff on the right is what that commit alone changed in the picked file;
- while the commit's files are being read, the place of the diff reads "Reading the commit…"; when the commit changed no file, "This commit changed no files."

A click on "All changes" goes back to everything the agent changed. No commit's files are read while "All changes" is picked.

A picked commit holds only while it is one of the agent's commits as last read, and only on the page of the agent it was clicked on: when it leaves the agent's commits, and on another agent's page, "All changes" is picked.

### The picked file's diff

#### Context

**User story**: the user opens the Changes tab and reads a diff at once, without a click; the list stays in view beside it, so going from file to file is one click each.

**Problem**: a diff is a git read. Reading every changed file's diff to draw the list would cost one read per file on every poll.

#### Business logic

Exactly one file of the list is picked:

- while the user has clicked no row, the first file of the list;
- once the user clicked a row, that file, for as long as it is in the list; a file asked for from the chat counts as a click on its row (see "A file asked for from the chat");
- when the clicked file leaves the list (the agent undid its change), the first file of the list again;
- a click counts for the list it was made in: on another agent's page, and after another commit or "All changes" is picked, the first file of the list then shown is picked, also when that list holds the same path.

The rest of the tab's width, on the right of the list, shows the picked file's diff in the preview card's body (`FilePreview.tsx`): the path and the lines added and removed, then the diff, read for the selected agent (in the picked commit alone, when a commit is picked), or for the project's checkout when none is selected, and read again every 5 seconds. This area scrolls by itself. Only the picked file's diff is read, so the tab costs one diff read however many files the list holds. When another file or another commit is picked, the area starts over with "Reading the diff…": a diff still being read is never shown under another file's or commit's name. When the list is empty, the area holds one line instead (see "An agent's changes" and "The commits").

### A file asked for from the chat

#### Context

See the user story on the agent's chat in `## Context`.

**Business logic story**: the tab declares to the dashboard that it lists what a run changed (`index.tsx`). The dashboard then hands it the changed file a click in the agent's chat asked to see: its path in the agent's checkout [2], and a number that grows with each ask. The dashboard hands the last ask of the agent's page again each time it draws the tab.

**Problem**: the last ask is handed again every time the tab is drawn. Taken each time, it would pick its file again over every click the user makes in the list, and again when the tab is closed and opened later.

#### Business logic

Each ask is taken once, by its number: an ask whose number is not above the last one taken, by this tab or by one drawn before it, is not taken. So a tab opened again later, still handed the same ask, picks the first file of its list as any tab does.

Taking an ask does what two clicks do:

- "All changes" is picked, so a picked commit gives way and the list is everything the agent changed;
- the file asked for is the clicked file of that list, on this agent's page: its row is highlighted and its diff is the one read.

After that the rules of "The picked file's diff" hold as for any click: a click the user makes in the list afterwards stands, the same ask not being taken again; a new ask, also for the same file, picks its file again; and while the list does not hold the file asked for (the agent undid its change, or the file is outside the agent's checkout), the first file of the list is picked.
