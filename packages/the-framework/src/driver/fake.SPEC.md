An in-memory driver that replays scripted turns deterministically, so the whole product — runs, gates, dashboard — works offline without spawning a process or spending a token.

## TLDR

- Emits the same events a real driver does and records every prompt it receives, so tests can assert both what the user saw and what the agent was told.
- A short script never starves a long run: once the turns run out, the last one repeats.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
