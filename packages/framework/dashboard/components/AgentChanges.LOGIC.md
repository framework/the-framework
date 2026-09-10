What a running agent [1] has changed so far, read from git in its checkout [2] rather than from the coding agent's [3] tool calls: the count of files touched with the lines added and removed, said in the action bar beside the branch, and behind the bar's disclosure the list of those files, each with its state, its counts, and its diff on demand. This is the running agent's surface only: a finished agent's checkout may be gone, and what it produced is answered by the handoff [4] read (`AgentHandoff.tsx`), which is addressed by branch.

## Context

**User story**: watching an agent, the user sees "Edit" go by in the feed and wants to know which file moved and how, without leaving the dashboard for `git diff`.

**Problem**: the driver [5] surfaces a tool's name but not its arguments, so the files an agent touched cannot be learned from what it said it did. Git in the agent's checkout is the honest source, the outcome rather than the intent, and it works for every coding agent.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[3] coding agent: the CLI doing the actual work: Claude Code or Codex.
[4] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it).
[5] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later.

## Business logic — TL;DR

- **The read** - the agent's changed files are read from its own checkout every 8 seconds, collapsed or not, and only for an agent whose checkout still exists.
- **The count in the bar** - the number of files and the totals of lines added and removed are reported to the action bar whenever they change, zero included; the bar says "<N> files" with the totals and nothing at all when nothing changed.
- **The list of files** - each file with its state ("new", "modified", "deleted"), its counts unless binary, and its diff, read only when the row is expanded.
- **Silence over errors** - an agent that changed nothing shows no panel, and a failed read leaves the panel silent.

## Business logic

### The read

#### Context

See `## Context`.

#### Business logic

The changed files are read from the agent's [1] own checkout [2] by the agent's id, and read again every 8 seconds, so the list follows the agent as it edits. The read keeps going while the list is collapsed, because the count it feeds the bar is the reason to open it. The agent's id is required, and the caller only shows this for an agent whose checkout still exists: once a checkout is gone, a read by that id falls back to the project root and would present the user's own uncommitted files as the agent's work.

### The count in the bar

#### Context

**User story**: the user reads "3 files +40 −12" beside the branch without opening anything, and knows whether there is something to open.

#### Business logic

Whenever the number of files or the totals change, they are reported to the action bar: the count of changed files, the sum of lines added and the sum of lines removed across them. Zero is reported too, so the bar knows there is no disclosure to offer. The bar's summary renders nothing when the count is zero; otherwise "<N> file" or "<N> files" followed by the added and removed totals (`DiffView.tsx`).

### The list of files

#### Context

**User story**: the user opens the disclosure and sees which files the agent [1] touched, and one click further, how.

#### Business logic

The list is shown only when the disclosure is open and at least one file changed; it is a section named "Changed files" for assistive technology, and it scrolls past a fixed height rather than pushing the feed down. Each row shows the file's directory muted and its name in monospace, the name struck through when the file is deleted; then the file's state as a word, "new" in green for an untracked file, "modified" in amber, "deleted" in red; then its lines added and removed, omitted for a binary file. Clicking a row expands it to the file's diff, the same one the file tree's hover card shows (`FilePreview.tsx`), read only at that moment: an agent that touched forty files does not cost forty diffs nobody asked for.

### Silence over errors

#### Context

**Problem**: an empty panel above the feed would only push the output down, and a read that fails while the daemon restarts must not take the page down with it.

#### Business logic

An agent [1] that has changed nothing renders no panel at all, whether the disclosure is open or not. A read that fails leaves the panel as it was, silent, rather than showing an error.
