The safe way the dashboard reads one file out of a checkout, used by the hover card to preview an unchanged file.

## User Stories

- The user hovers an unchanged file and previews the agent's own copy of it — the worktree's, not the project root's.

## Flows

- One guard for every client-supplied path: repo-relative only, no traversal, no absolute paths, and never into git's own folder, where credentials live.
- Confinement is real, not textual: symbolic links are resolved before checking the file sits inside the checkout, so a link pointing outside is refused.
- Previews are cut at a fixed length, binary files say so instead of rendering bytes, and anything unreadable is simply nothing.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
