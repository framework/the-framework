Shows what actually changed in a checkout's files: one file's diff for the tree's hover card, and every changed file's line counts for the agent's Changes list.

## User Stories

- The user hovers a changed file in the tree and reads its diff without leaving the dashboard.
- The user's Changes list names every file the agent touched, with added and removed line counts.

## Flows

- Tracked files diff against the last commit, so a change the agent already staged still shows; an untracked file, having nothing to diff against, renders as all-added from its contents.
- A binary change says so instead of dumping bytes, and a long patch is cut for display and says it was cut.
- The whole Changes list costs two git reads however many files changed, and stays sorted so it does not reshuffle under the user while a live agent edits.
- Paths come from the client, so every one goes through the shared path guard (repo-relative only, no traversal) before anything is read.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
