The live agent's changed-files panel: which files it has touched so far, each row expanding to its diff.

## Flows

- The list is derived from the agent's own working copy, not from its tool calls — it reports the outcome rather than the intent, and works the same for every driver.
- A row's diff loads only when the user opens it. The running totals (files, lines added/removed) are reported up, so the action bar shows them while the list is collapsed.
- Live agents only: a finished agent is answered by the end-of-work handoff, which reads from the branch and so survives the working copy's removal. This panel must never be shown after that removal — it would present the user's own uncommitted files as the agent's work.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
