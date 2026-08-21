The notification engine: a background poll over the registered projects that announces only what newly appeared, so a Discord message fires even when no dashboard is open.

## User Stories

- The user hears about what newly needs them, or newly happened, without keeping a dashboard open.
- The user is not flooded at daemon start: what already existed by then is never announced.

## Flows

- The first look only takes a baseline — whatever already existed when the daemon started is never announced; the user only hears about what happens while it watches.
- What makes two items "the same" is the caller's decision, so one engine serves both callers: the "needs you" queue (open PRs, parked questions, unpushed work) and the activity feed (agents started and finished).
- Forgiving: a failed scan or projection simply announces nothing that cycle.
- It owns no timer of its own — the daemon's one clock calls it — so its cadence is declared where every other background job's is.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
