The project's file tree in the dashboard's right rail: the repo's files as a collapsible tree, marked with what the agent has changed, and doubling as the picker for which files go into the agent's Context.

## Glossary

- **Context** - the repos and files the user hands an agent to start from.

## Business logic — TL;DR

- **A picker, not an editor** - clicking a file puts it into the agent's Context or takes it back out; picked files are ticked and highlighted. It feeds exactly the same set as a `#` mention in the prompt and the whole-repo Context picker.
- **Git's verdict, per row** - a changed file carries the letter for its change (untracked, modified, deleted) and takes that change's colour; a folder carries a dot in the same colours, saying only that something beneath it changed. A folder whose changed files disagree reads as modified.
- **The marks describe the agent's own checkout** - status is read against the selected agent's worktree, so the tree agrees with the branch and the actions shown above it, and it is re-read every few seconds so an agent editing files shows up as it works.
- **Pointing shows the file** - every file previews on hover; the tree's own status decides whether that preview is a diff or the file's contents, so no second lookup is needed to find out.
- **Usable on a large repo** - a filter box narrows the tree to matching paths and reports how many of the repo's files match; a filter matching nothing says so rather than showing an empty pane. The tree scrolls inside itself rather than stretching the rail past everything below it.
- **Nothing to show, nothing shown** - a project with no files renders no tree at all.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
