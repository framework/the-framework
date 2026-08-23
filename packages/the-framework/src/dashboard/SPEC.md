The daemon's dashboard-serving side: the HTTP server that hosts the browser app, and every projection and action behind it. Nothing here renders — the browser app (the top-level `dashboard/` directory) does; this directory answers its questions and carries out its actions.

## Business logic — TL;DR

- **The server** - one HTTP server on the daemon's port serves the built browser app as static files, mounts the RPC surface under `/_rpc` (same-origin guarded, and behind a shared token whenever the bind is not loopback), the daemon-to-daemon relay under `/_relay`, and the Claude web bridge's endpoint — the one route deliberately reachable from another origin, gated by its own token.
- **Projections** - every read the dashboard makes is computed from the same files the daemon and agents write: project summaries, the cross-project Overview, recent agents, hot tickets, the agent queue, tickets, open questions, per-file git status and diffs, surfaced PLAN/TODO documents, and the quota view.
- **The handoff engine** - pushing an agent's branch, opening its pull request, merging it, and deciding when a finished agent may publish itself automatically — including the reasons a merge is withheld.
- **Notifications** - a background poll watches two feeds across all projects — interventions ("needs you") and activity ("new activity") — and announces only what is new, to the browser and optionally to Discord.
- **Remote agents** - the relay lets this daemon start an agent on a saved device (another machine's daemon), stream its events back, and forward run-scoped reads and steering to it, so a remote agent renders like a local one.
- **GitHub, cached** - all GitHub facts come from the `gh` CLI through a read-through cache (single flight, stale-while-revalidate), so polling surfaces never multiply subprocess calls.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
