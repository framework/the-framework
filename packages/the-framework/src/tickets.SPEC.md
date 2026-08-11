The repo's ticket and queue conventions: tickets are plain markdown files in a root `tickets/` folder, the confirmed-task queue is the one root `TODO_AGENTS.md` file, and this defines how the two reference each other.

## TLDR

- A ticket put on the queue keeps its identity as a markdown link back to the ticket file; only a plain file directly inside the tickets folder counts — the value is rendered and opened by people, so traversal, absolute paths, URLs, and nesting are all refused.
- A ticket's written priority (0-10) maps straight onto the queue's numbered sections; anything else — words, out-of-range, fractions — lands in the middle rather than being guessed at.
- A ticket's GitHub header names the issue it tracks, which is what lets merging the work close that issue.
- One queue location; the older spellings are no longer read.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
