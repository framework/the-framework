What a working agent [1] has changed so far, on its page: the count of files it touched with the lines added and removed, in the page's action bar, and, while the bar is open, the list of those files under it, each with its state, its counts, and its diff on demand. Read from git in the agent's own checkout [2] rather than from the coding agent's [3] tool calls. These are the Files module's [6] two run slots [7]: the summary and the details.

## Context

**User story**: watching an agent, the user sees "Edit" go by in the feed and wants to know which file moved and how, without leaving the dashboard for `git diff`.

**Problem**: the driver [5] surfaces a tool's name but not its arguments, so the files an agent touched cannot be learned from what it said it did. Git in the agent's checkout is the honest source, the outcome rather than the intent, and it works for every coding agent.

**Problem**: once an agent has ended, its checkout may be gone. What it produced is then the handoff's [4] to say, from its branch; reading by the agent's id with no checkout must never show the project folder's own changes as the agent's.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[3] coding agent: the CLI doing the actual work: Claude Code or Codex.
[4] handoff: what becomes of an agent's work once the agent has ended: its branch pushed, a pull request opened for it, the pull request merged. The agent does it itself only when its task or the person asks; on a finished agent's page the "Open PR" and "Merge" buttons do it by hand.
[5] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later.
[6] module: a package that adds to the dashboard (pages, Overview cards, side-rail tabs, what an agent's page shows, actions on the links pages show, Settings sections): its browser part, named by the package's `exports["./dashboard"]`, reads its data through its own package's command, or through its own server part, named by `exports["./server"]`, which the daemon calls in its own process. A module comes from a project's dependencies, or is built into the dashboard and loaded for every project, as the Files module is.
[7] run slot: a place on an agent's page a module fills: the summary, a few words in the action bar, shown until the agent has ended and its branch has been read (the handoff's own words take over then); and the details, a block under the bar. Each is told the agent, whether it is still working, and whether the bar is open.

## Business logic — TL;DR

- **The read** - the agent's changed files are read from its own checkout, through the module's server part, when the agent is first seen working and every 8 seconds after, and never while it is not working; the list shows what the count last read, so the checkout is read once per tick.
- **The count in the bar** - "<N> file" or "<N> files" with the lines added and removed; nothing when nothing changed; an agent that stops keeps the count it ended with until the handoff takes over.
- **The list of files** - while the agent works and the bar is open: each file with its state ("new", "modified", "deleted"), its counts unless binary, and its diff, read only when the row is expanded.
- **Silence over errors** - an agent that changed nothing shows neither count nor list, and a failed read keeps the last count.

## Business logic

### The read

#### Context

See `## Context`.

#### Business logic

The summary makes the read: the moment the agent [1] is working, and again every 8 seconds while it works, it asks the module's server part for the changed files of the agent's own checkout [2], by the agent's id. The server part answers from the checkout the dashboard names for the agent, and answers an empty list when the agent has no checkout: it never reads the project folder in its place. While the agent is not working nothing is read, not even once: an agent that ended may have no checkout left, and an agent seen only after it ended shows no count. The last answer is kept per agent for the page's life, and the list under the bar shows that same answer, so opening the bar costs no second read.

### The count in the bar

#### Context

**User story**: the user reads "3 files +40 −12" beside the branch without opening anything, and knows whether there is something to open.

#### Business logic

The summary shows the number of changed files as "<N> file" or "<N> files", followed by the sum of lines added and the sum of lines removed across them, as the dashboard's "+added −removed" pair; with no changed file it shows nothing. When the agent stops, the count it last read stays: the dashboard shows the summary only until the agent's branch has been read, and then the handoff's [4] own words about the branch take its place, so the bar swaps once instead of blanking.

### The list of files

#### Context

**User story**: the user opens the bar and sees which files the agent [1] touched, and one click further, how.

#### Business logic

The list is shown only while the agent works, the bar is open, and at least one file changed; it is a section named "Changed files" for assistive technology, and it scrolls past a fixed height rather than pushing the feed down. Each row shows the file's directory muted and its name in monospace, the name struck through when the file is deleted; then the file's state as a word, "new" in green for an untracked file, "modified" in amber, "deleted" in red; then its lines added and removed, omitted for a binary file. Clicking a row expands it to the file's diff, the same one the Files tab's hover card shows (`FilePreview.tsx`), read only at that moment: an agent that touched forty files does not cost forty diffs nobody asked for.

### Silence over errors

#### Context

**Problem**: an empty panel above the feed would only push the output down, and a read that fails while the daemon restarts must not take the page down with it.

#### Business logic

An agent [1] that has changed nothing shows no count and no list. A read that fails keeps the last count and list as they were, rather than showing an error; the next tick usually succeeds.
