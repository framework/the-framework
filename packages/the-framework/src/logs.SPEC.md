The committed project log: a human-readable markdown record inside the repo of every session The Framework ran, one entry per run.

## TLDR

- Each entry records when the run happened, what kind it was (loop, standalone prompt, or build), its intent, how it ended, and pointers back to the session and the branch its work landed on.
- Free text (a run's prompt, agent-written summaries) is escaped onto one line, so a crafted prompt cannot forge entries or rewrite an outcome in the committed history.
- Reading is forgiving — a malformed entry is skipped, never fatal — and returns entries newest-first.
- A companion gitignore keeps the log committed while all other run state in the same directory stays out of git.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
