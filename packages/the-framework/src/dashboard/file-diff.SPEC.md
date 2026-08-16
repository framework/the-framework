Shows what actually changed in a checkout's files: one file's diff for the tree's hover card, and every changed file's line counts for the agent's Changes list.

## TLDR

- Tracked files diff against the last commit, so a change the agent already staged still shows; an untracked file, having nothing to diff against, renders as all-added from its contents.
- A binary change says so instead of dumping bytes, and a long patch is cut for display and says it was cut.
- The whole Changes list costs two git reads however many files changed, and stays sorted so a live agent does not reshuffle it.
- Paths come from the client, so every one goes through the shared safety guard before anything is read.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
