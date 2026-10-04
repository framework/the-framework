The Changes tab the Files module [4] adds to the side rail: only the files that changed, each opening to its diff. With an agent [1] selected, the list is what that agent changed, read from wherever its files are now, and kept once its work is merged. With no agent selected, the list is the files changed in the project's checkout [2] and not committed. With nothing changed, the tab says so in one line.

## Context

**User story**: the user opens an agent's page to see what the agent did, without walking the whole tree: the Changes tab lists the changed files alone, and a click on one shows its diff.

**User story**: the user merged an agent's work last week. The Files tab's tree is plain now, since its marks say what is not merged yet. The Changes tab still lists what that agent changed, and says it is merged.

**User story**: on the project's own page, the user sees which files of the project's folder are changed and not committed.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. The user's own working copy is "the project's checkout".
[3] mark: what happened to a changed file, added, untracked, modified or deleted, and whether the change is committed or only on disk.
[4] module: a package that adds to the dashboard (pages, Overview cards, side-rail tabs, what an agent's page shows, actions on the links pages show, Settings sections): its browser part, named by the package's `exports["./dashboard"]`, reads its data through its own package's command, or through its own server part, named by `exports["./server"]`, which the daemon calls in its own process. A module comes from a project's dependencies, or is built into the dashboard and loaded for every project, as the Files module is.

## Business logic — TL;DR

- **An agent's changes** - with an agent [1] selected, every file the agent changed, sorted by path, under a caption saying whether the work is merged; "This run changed no files." when there is none; "Looking for this run’s changes…" while that is not known yet, and one line saying the changes are gone when no source is left.
- **The project folder's changes** - with no agent selected, every file changed in the project's checkout [2] and not committed, or "Nothing is changed in the project’s folder."
- **One row per file** - the file's path, "new", "modified" or "deleted", and "not committed" for a change that is only on disk; a click opens the file's diff under the row, read only then.

## Business logic

### An agent's changes

#### Context

**Problem**: the Files tab marks an agent's changes only while they are not merged. Without a second place, what a merged agent changed would be shown nowhere.

#### Business logic

With an agent [1] selected, the tab reads the agent's tree from the module's server part, the same read the Files tab makes (the source rules in `src/tree.ts`), every 8 seconds, and a moment (300 ms) after each new event in the agent's feed, since the agent may have just changed a file; a burst of events is one read. Of the answer it uses the changed files and their marks [3], and whether the agent's work is merged; the tree of all files is not shown.

- The list holds every changed file, sorted by path, a deleted file included.
- A caption above the list reads "What this run changed. Merged." when the answer says the agent's work is merged, and "What this run changed. Not merged yet." otherwise.
- When the answer names no changed file, the tab reads "This run changed no files."
- Until the first answer arrives, and while the answer is pending, the tab reads "Looking for this run’s changes…". When an agent whose list the tab showed answers pending (its checkout reclaimed as it ends, its branch not read yet), the tab keeps showing the list it had.
- When none of the agent's sources is left on this machine, the tab reads "This run’s changes are gone from this machine: its checkout was reclaimed and it left no branch or merged pull request here."

The project's own files are not read for an agent.

### The project folder's changes

#### Context

See `## Context`.

#### Business logic

With no agent selected, the tab reads the project's files and the status of the project's checkout [2] from the module's server part, the read the Files tab makes there, every 8 seconds, and lists the changed files, sorted by path; every change there is uncommitted. The caption reads "Changed in the project’s folder, not committed." Until the first read answers, the tab reads "Reading the project’s files…"; when nothing is changed, "Nothing is changed in the project’s folder." No agent's tree is read.

### One row per file

#### Context

**Problem**: a diff is a git read. Reading every changed file's diff to draw the list would cost one read per file on every poll.

#### Business logic

Each row is a button showing the file's path, its folders dimmed and its name struck through when the file was deleted, and on the right what happened to it: "new" in green for an added or untracked file, "modified" in amber, "deleted" in red. A change that is only on disk, not committed, also reads "not committed". Clicking the row opens it, and clicking again closes it: an open row shows the file's diff under it, in the preview card's body (`FilePreview.tsx`), read for the selected agent, or for the project's checkout when none is selected. The diff is read only while the row is open, so a list costs one read however many files it holds.
