Shows what actually changed in a checkout's [1] files, for the file tree's hover card and the agent view's [2] "Changes" section: one file's unified diff (a tracked file against the last commit, hunks only; an untracked file rendered as all-added from its contents; a binary change reported as binary), capped at 500 lines, and the whole list of changed files with their added and removed line counts, bought with one git call rather than one diff per file. The read is made against whatever checkout the caller resolved, so an agent's [3] hover shows its own checkout and not the project's, and every path comes from the browser, so nothing is read before the path passes the guard in `file-read.ts`.

## Context

**User story**: the file tree already marks a file as modified, untracked or deleted; hovering it shows what changed without leaving the dashboard for `git diff`, and the agent view's "Changes" section lists every file an agent touched with how much moved, updating as a live agent edits.

## Glossary

[1] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. The user's own working copy is the project's checkout.
[2] agent view: one agent's page.
[3] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[4] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it).

## Business logic — TL;DR

- **A tracked file's diff** - the file's diff against the last commit with three lines of context, stripped of git's preamble, with added and removed lines counted; no diff means no card, a binary change says so, and a long patch is cut at 500 lines and says it was cut.
- **An untracked file as all-added** - a file git does not know is read from disk inside the checkout and shown with every line as an addition, counted whole even when its preview is cut.
- **Unsafe paths are refused before any read** - a path that is not a plain repository-relative path yields nothing and never reaches git or the disk.
- **The "Changes" list** - every changed file with its line counts from one numstat read, untracked files counted from disk, binary files flagged, sorted by path so a live agent's list does not reshuffle.

## Business logic

### A tracked file's diff

#### Context

See `## Context`.

#### Business logic

A modified or deleted file is diffed against the last commit, not against the index, so a change the agent [3] has already staged still shows, which also matches the status read that marked the file in the first place; the diff carries three lines of context. In a repository with no commit yet, the working-tree diff is the honest answer rather than an error, so it is read instead; when git fails altogether, there is nothing to show. Git's preamble (the `diff --git`, index and mode lines) is dropped and the body starts at the file headers or the first hunk. Added and removed lines are counted from the body, ignoring the two file headers that precede the first hunk; past that hunk a line that happens to open the same way is content (a removed `---` separator reads `----`, a removed `-- comment` reads `--- comment`) and counts. A file with no diff yields nothing rather than an empty card. When git reports a binary change, the answer is flagged binary with an empty body and zero counts. A body longer than 500 lines is cut to 500 and flagged as truncated.

### An untracked file as all-added

#### Context

**Problem**: an untracked file has no committed version to diff against, and asking git to diff it against nothing reads as a failure.

#### Business logic

An untracked file is read from disk through the confined read in `file-read.ts`, so a file outside the checkout [1], reached through a symlink for instance, or an unreadable one yields nothing, and git is never asked. A file containing a NUL byte is flagged binary with an empty body. Otherwise every line becomes an added line (a trailing newline is not a line), the preview is cut at 500 lines and flagged when cut, and the added count is the file's whole line count, not the preview's, because the "Changes" list reports the file's own size and a long new file must not read as exactly the cap.

### Unsafe paths are refused before any read

#### Context

**Problem**: the path comes from the browser, and this is the first read that takes a caller-supplied path; a wrong path could read outside the checkout or hand git a flag.

#### Business logic

A path that fails the guard in `file-read.ts` (not a plain repository-relative path: traversal, absolute, a leading dash, anything under `.git`, an empty segment, a NUL byte) yields nothing, and neither git nor the disk is touched. The guard is the only way in, and every caller goes through it.

### The "Changes" list

#### Context

**User story**: the agent view's [2] "Changes" section lists every file the agent [3] changed with how many lines were added and removed; an agent that touched forty files must not cost forty diffs.

#### Business logic

Given each changed file's status (from `file-status.ts`), any path failing the guard is dropped, and with nothing left the list is empty without asking git. Otherwise one numstat read against the last commit (falling back to the working tree in a repository with no commit, and to no counts at all when git fails) gives the added and removed lines of every tracked change. The numstat grammar is parsed in one place, shared with the handoff [4] summary: a line is the added count, the removed count and the path, separated by tabs, a path containing a tab is kept whole, a malformed line is skipped, and a `-` count marks a binary file, which is flagged binary with zero counts. A tracked file without a numstat entry reads as zero lines either way. An untracked file is in no diff, so its whole content is the addition: its added count is its line count from disk, and a binary one is flagged binary. The list is sorted by path so it does not reshuffle while a live agent edits.
