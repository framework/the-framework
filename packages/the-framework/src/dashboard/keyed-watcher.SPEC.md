The notification engine: a background poll over the registered projects that announces only what newly appeared, so a Discord message fires even when no dashboard is open.

## User Stories

- The user hears about what newly needs them, or newly happened, without keeping a dashboard open.
- The user is not flooded at daemon start: what already existed by then is never announced.
- The user is not flooded by a start-up that could not reach GitHub either: a project nothing could be read from is not mistaken for a project with nothing in it.

## Flows

- The first look at a project only takes a baseline — whatever already existed there when the daemon started is never announced; the user only hears about what happens while it watches.
- What makes two items "the same" is the caller's decision, so one engine serves every caller: the "needs you" queue (open PRs, parked questions, unpushed work), the activity feed (agents started and finished), and the dashboard's own browser notifications, which keep their baseline by the same rule rather than a rule of their own.
- What counts as a baseline is decided per project: a project earns one from the first look that read it completely, so a project that was unreachable at start-up is simply not being watched yet, rather than being watched against an empty picture of itself.
- Forgiving, and honest about it: a failed scan or projection announces nothing that cycle and earns no baseline, and one project that can never be read — a repo with no remote, say — leaves the others notifying normally instead of silencing them or flooding them.
- It owns no timer of its own — the daemon's one clock calls it — so its cadence is declared where every other background job's is.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
