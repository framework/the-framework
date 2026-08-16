The live session's changed-files panel: which files the run has touched so far, each row expanding to its diff.

## TLDR

- Derived from the session's own working copy, not from the agent's tool calls — the outcome rather than the intent, and it works the same for every agent.
- Diffs load only when a row is opened; the running totals (files, lines added/removed) are reported up so the action bar can show them while the list is collapsed.
- Live sessions only: a finished session is answered by the handoff, which survives the working copy's removal — and this panel must never be shown after that removal, or it would present your own uncommitted files as the session's work.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
