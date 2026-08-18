The live agent's changed-files panel: which files it has touched so far, each row expanding to its diff.

## TLDR

- Derived from the agent's own working copy, not from its tool calls — the outcome rather than the intent, and it works the same for every driver.
- Diffs load only when a row is opened; the running totals (files, lines added/removed) are reported up so the action bar can show them while the list is collapsed.
- Live agents only: a finished agent is answered by the handoff, which survives the working copy's removal — and this panel must never be shown after that removal, or it would present your own uncommitted files as the agent's work.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
