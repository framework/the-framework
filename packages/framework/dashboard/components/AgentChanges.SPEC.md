The list of files a running agent has changed so far, read from its own worktree: each file's path, whether it is new, modified or deleted, how many lines it gained and lost, and — on click — its diff. It also supplies the running totals ("N files", plus lines added and removed) that the agent's action bar shows beside its branch.

## Business logic — TL;DR

- **Derived from the worktree, not from what the agent said** - the changes come from the state of the agent's checkout, so they are the outcome rather than the agent's stated intent, and they work for every driver.
- **Refreshed while the agent works** - the list is re-read every few seconds, and keeps refreshing even while collapsed, because the file count is the reason to open it.
- **A row opens its diff** - a file's diff is only fetched when the user expands that file.
- **Nothing to show, nothing shown** - an agent that has changed nothing renders no panel at all.

## Business logic

### Which files the agent touched

#### User story

Watching an agent work, the user sees it editing files but not which ones; finding out otherwise means leaving the dashboard for the command line.

#### Business logic

For each changed file the panel shows its directory and file name (a deleted file's name struck through), a status of new, modified or deleted, and — unless the file is binary — how many lines it added and removed. Expanding a row shows that file's diff, fetched only at that point; collapsing it hides it again. The list has no header of its own: the action bar above it already says how much changed, and this says which files.

#### Rationale

The changes are read from git rather than from the agent's tool calls, because the driver deliberately surfaces a tool's name without its arguments, and because git reports what actually happened rather than what the agent set out to do.

### Only for an agent that still has its checkout

#### User story

A finished agent whose worktree has been reclaimed has no checkout left to read.

#### Business logic

This panel is only shown for an agent whose worktree still exists; asking for a removed one would fall back to the project itself and present the user's own uncommitted files as the agent's work. A finished agent's changes are instead answered by its handoff panel, which is addressed by branch and so survives the worktree's removal.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
