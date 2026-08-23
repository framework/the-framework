What actually changed in a changed file, without leaving the dashboard for `git diff`. Two reads, both against the checkout the caller resolved — so an agent's view shows its own worktree, never the project root: one file's diff, for the file tree's hover card and the agent view's Changes section, and the full changed-file list with per-file line counts, for the Changes list. The file tree already dots a file as changed; these say what changed.

## Business logic — TL;DR

- **One file's diff** - a tracked file diffs against the last commit rather than the index, so a change the agent already staged still shows — matching the status read that dotted the file. In a repo with no commits yet, the working-tree diff is shown instead of an error. An untracked file has nothing to diff against, so its contents render as all-added, read through the confined file read (the same symlink containment as the contents preview). A binary change is flagged instead of dumped. The patch keeps only the hunks (git's preamble is dropped), is capped at the 500-line preview limit and marked when cut, and carries added/removed line counts. A file with nothing to show yields nothing, not an empty card.
- **The Changes list** - every changed file with its added/removed counts, from one `git status` plus one `git diff --numstat` — two git calls however many files the agent touched. Untracked files appear in no diff, so their added count is their line count, read from disk. The list is sorted by path so it does not reshuffle while a live agent edits. One parser owns the numstat grammar (tab-separated added/removed counts and path, `-` counts for a binary file, tabs allowed inside the path), shared with the handoff's own file counts rather than copied — two copies of it had already drifted on the tab-in-path case.
- **Unsafe paths never reach git or disk** - the requested path comes from the client, so both reads pass it through the shared repo-path guard first; a path that fails yields nothing, before any git call or file read.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
