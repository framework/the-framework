Takes a tool's own directory at a project's root away again: the files the tool names as its own, one by one, then the directory once it is empty, then the rule hiding the directory from git once no checkout of the repository has one. What a tool's `cleanup` command runs when its files are a few named files in one directory (`agent-scheduler`, the orchestration skill).

## Context

**User story**: the user removes a project from the dashboard and asks for the tools' files in the folder to go too. Each tool's directory disappears with what the tool wrote there; anything the user put in it stays, and the user reads which.

**Business logic story**: a tool knows which files it writes, and nothing else may go. So the caller names its directory and its files, and this module removes only those. It never touches the remote, a commit, a branch, the working tree outside the directory, a file git tracks, or another tool's files.

**Problem**: a person may have put a file in the tool's directory. The directory may be a link to somewhere outside the project. The rule that hides the directory from git is the repository's, read by every checkout of it, the main checkout and every linked worktree: taking it out for one project would show another checkout's directory in its status.

## Business logic — TL;DR

- **No directory, nothing touched** - where the project has no such directory the answer is `{ removed: [], kept: [] }` and nothing changes, the exclude file included: a rule written by hand stays.
- **A link is followed nowhere** - a directory name that is not a real directory (a link, a file) is kept, named by the directory's name with the reason `not made by <tool>`, and nothing else happens.
- **The named files go one by one** - an entry whose name the tool named, that is a regular file and that git does not track, is removed. A file git tracks is kept with the reason `git tracks it`. Any other entry, a directory under a named file's name included, is kept with `not made by <tool>`.
- **The directory goes only when nothing was kept** - it is removed as an empty directory, never with its contents, and the answer names it alone in `removed`. When something was kept, the directory and its rule stay, and `removed` names each file that went. When the removal of the empty directory fails, the directory is kept with `not empty` and `removed` still names each file that went.
- **The rule is the repository's** - the line `/<directory>` is taken out of the repository's exclude file only when this pass removed the directory and no checkout of the repository still has one. A failure to list the checkouts or to take the rule out leaves the rule and changes nothing in the answer.
- **The answer** - `{ removed: [<paths>], kept: [{ path, reason }] }`, paths from the project's root, entries in name order.
