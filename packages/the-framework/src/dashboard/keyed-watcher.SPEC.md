The notification engine: a background poll over the registered projects that announces only what newly appeared, so a Discord message fires even when no dashboard is open.

## TLDR

- The first look only takes a baseline — whatever already existed when the daemon started is never announced; you only hear about what happens while it watches.
- What makes two items "the same" is the caller's decision, so one engine serves both the needs-you queue and the activity feed.
- Forgiving: a failed scan or projection simply announces nothing that cycle.
- It owns no timer of its own — the daemon's one clock calls it — so its cadence is declared where every other background job's is.

## Before modifying/creating SPEC.md files

Always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
