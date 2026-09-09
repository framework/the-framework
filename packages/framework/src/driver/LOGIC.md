Holds the one driver [1] implementation that lives in the product rather than in the `agent-driver` package: `claude-web`, the driver behind the `web` location [2], which needs the daemon's Claude web bridge [3] to have a cloud session [4] created on claude.ai. The driver contract and the other implementations (`claude-code`, `codex`, `github-actions`, `fake`) are in `packages/agent-driver/`; which implementation an agent [5] gets for its location is decided in `target-driver.ts`. The `*.BUG-ANALYSIS.md` files are review bookkeeping and carry no business logic.

## Context

**User story**: the user starts an agent with its location set to `web`; the task leaves the machine for a Claude Code cloud session that pushes its own branch and opens its own pull request, and the agent view [6] links to that session.

## Glossary

[1] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later. The driver implementations are `claude-code`, `codex`, `github-actions`, `claude-web` and `fake`.
[2] location: where an agent's turns run: `local` (this machine), `actions` (a GitHub Actions runner), or `web` (a Claude Code cloud session).
[3] the Claude web bridge: the daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session is parked on into the dashboard, and types the pick back into the session.
[4] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[5] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.
[6] agent view: one agent's page in the dashboard.
[7] cloud anchor: an empty commit a web agent pushes before its task leaves this machine, unique to the agent: the branch the cloud session later pushes descends from it, which is how the daemon recognizes that branch as the agent's (cloud work adoption).

## Business logic — TL;DR

- **Handing the task to a cloud session** (`cloud.ts`, `cloud.test.ts`) - a web agent's first turn pushes its cloud anchor [7] to the project's GitHub `origin`, has the extension create the cloud session on that ref with the task as its first message and the chosen model, and reports the session link into the agent's events; every later turn only says the work is already there; each missing prerequisite (a daemon that spawned the agent, a GitHub `origin`, the bridge on, an extension present) names itself in the failure the user reads.
