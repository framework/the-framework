The notification engine: a background poll over the registered projects that announces only what newly appeared, so a Discord message fires even when no dashboard is open.

## TLDR

- The first look only takes a baseline — whatever already existed when the daemon started is never announced; you only hear about what happens while it watches.
- What makes two items "the same" is the caller's decision, so one engine serves both the needs-you queue and the activity feed.
- Forgiving: a failed scan or projection simply announces nothing that cycle, and the poll never keeps the daemon alive past shutdown.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
