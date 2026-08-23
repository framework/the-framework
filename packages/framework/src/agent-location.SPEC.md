Names the run target axis — where an agent's turns execute: `local` (this device), `actions` (a GitHub Actions runner) or `web` (a Claude Code cloud session) — validates a run target arriving from the dashboard or a config file, and says which run target is hands-off.

## Business logic — TL;DR

- **Where an agent runs is its own axis** - the run target is independent of the driver: it says where the turns execute, not which coding-agent CLI does the work.
- **`web` is hands-off** - a cloud session is handed the task somewhere this machine cannot follow, so the first prompt is the whole agent; an Actions runner is followed exactly like a local agent.

## Business logic

### Where an agent runs is its own axis

#### User story

The user picks which coding-agent CLI works a task and, separately, where that work happens. Both choices show up on the dashboard, are saved in the registry, and are recorded with the agent.

#### Business logic

There are exactly three run targets: `local`, `actions` and `web`. A value arriving from a browser or a config file is accepted only when it names one of them.

#### Rationale

Run target and driver used to be one dimension: the same Claude Code agent counted as a different driver depending on whether it ran on this machine, on claude.ai, or in a GitHub Actions runner. The cost was a property of *where* leaking into the abstraction for *what* — being hands-off was carried as a driver property that disabled half an agent's phases. Splitting the axes puts hands-off where it belongs, as a fact about the run target.

### `web` is hands-off

#### User story

A user hands a task to a Claude Code cloud session. The dashboard must not offer to continue that agent, ask it to start the next backlog item, or wait for it to answer — the work is happening somewhere this machine cannot follow.

#### Business logic

Only the `web` run target is hands-off. For a hands-off agent the first prompt is the whole agent: no gates, no backlog loop, no live chat. A cloud session opens its own pull request and never reports back to this machine.

The `actions` run target is not hands-off: an Actions runner streams the agent's own replies back, so it is followed exactly like an agent running on this device.

#### Rationale

Without this rule, everything an agent normally does after its first prompt would be reading the driver's own "handed off to <url>" summary as if the agent had written it — which is what once put an unanswerable "Start the next backlog item?" question on the dashboard for an agent that was somewhere else entirely.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
