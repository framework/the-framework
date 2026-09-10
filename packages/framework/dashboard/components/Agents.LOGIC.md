The Overview's [1] "Agents" card, described as "Agents currently working": one row per agent [2] at work right now across every project, each row opening that agent's own page. Finished agents are not listed here; the sidebar's agent list carries them.

## Glossary

[1] the Overview: the dashboard's cross-project page at `/`.
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[3] session name: the name an agent gives its own work (`[a-z0-9-]+`); its branch is renamed to `agent-<session name>` and the dashboard labels the agent by it.
[4] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[5] the Claude web bridge: the daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session is parked on into the dashboard, and types the pick back into the session.
[6] device: another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.

## Business logic — TL;DR

- **What a row shows** - the agent's one-line label, the same the sidebar shows: what the user asked for, else the session name [3] it chose, else its scope, else its project's name; then its project's name and its age ("22s ago") with the exact moment on hover.
- **A web agent's cloud side** - a row tagged "in cloud" while the agent works in its cloud session [4], or "waiting" while it is parked on a question the Claude web bridge [5] reported; it is listed although its local half is over, because the cloud side is the agent.
- **An agent from another machine** - a row tagged "from <host>" when another machine's daemon started it, as a device [6] would; this daemon's own agents carry no tag.
- **Opening an agent** - clicking a row opens the agent itself, project and agent both, never only the project's launcher.
- **Loading and empty** - "Loading…" while the first read is still out, which is not the same as "No agents working right now." once it is known that nothing is working.
