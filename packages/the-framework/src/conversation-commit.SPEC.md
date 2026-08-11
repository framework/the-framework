Automatically commits the conversations and archived sessions the daemon records in a project's main checkout into its Git history, closing the gap between "the chat is recorded" and "the chat reaches Git by itself".

## TLDR

- Only the framework's own record files are committed — staging and committing are scoped to their paths, so the user's in-progress and staged work is never swept in or disturbed.
- Commits are debounced: a conversation still being written is left alone until it looks unchanged across two polls, with a time cap so a never-idle chat still lands.
- A repo that is mid-rebase, mid-merge, or locked by another git process is skipped and retried later, never committed into.
- On daemon shutdown, everything pending is committed immediately instead of waiting for quiet.

## Rationales

- A commit per chat turn would bury the project's real history under transcript noise, so batches land only once a conversation settles.
- Failures are values, retried on the next poll, and logged only when the reason changes — a stuck project costs one log line, not one per poll.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
