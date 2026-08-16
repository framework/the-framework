Automatically commits the agent archives the daemon writes into a project's main checkout into its Git history, closing the gap between "the history is recorded" and "the history reaches Git by itself".

## TLDR

- Only the framework's own archive files are committed — staging and committing are scoped to their path, so the user's in-progress and staged work is never swept in or disturbed.
- Commits are debounced: a project still being written to is left alone until it looks unchanged across two polls, with a time cap so a never-idle project still lands.
- A repo that is mid-rebase, mid-merge, or locked by another git process is skipped and retried later, never committed into.
- Nothing pending is a quiet skip, not a failure: a pathspec matching no file aborts the whole command, so a project with no archive yet would otherwise log an error on every poll.
- On daemon shutdown, everything pending is committed immediately instead of waiting for quiet.

## Rationales

- A commit per write would bury the project's real history under noise, so batches land only once a project settles.
- Failures are values, retried on the next poll, and logged only when the reason changes — a stuck project costs one log line, not one per poll.
- One record means one pathspec. A second one lived here — the per-agent conversation markdown — and with it the machinery for deciding which of the two to pass, because passing a pattern that matches nothing fails the command for the other.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
