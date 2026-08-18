Reads Claude Code's own record of which folders it trusts, so the dashboard can warn that a cloud agent on an untrusted project would die on the CLI's interactive trust question before the work is spent.

## TLDR

- Read-only on purpose: trusting a folder is the driver CLI's security decision; the framework reports it and points at the one-time fix, never makes the decision for the user.
- A folder never asked about reads as untrusted (the question will fire there — exactly when to warn); a record that is missing or not understood answers unknown, and the dashboard simply shows nothing extra.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
