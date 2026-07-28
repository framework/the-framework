Node-free vocabulary of drivable agents (`claude`, `codex`) shared by the CLI's `--agent` flag, the registry's preference sanitizer, and the dashboard bundle (#542).

## TLDR

- `AGENTS` / `AgentName` / `isAgentName()` — the canonical agent list and its type guard.
- `AGENT_LABELS` — display names ("Claude Code", "Codex").
- `agentForDriver()` — maps a run's recorded driver name back to its agent (#831).

## Decisions

- Deliberately free of Node imports so the dashboard can import it without touching the driver layer (which spawns processes); each surface previously kept a drifting local copy.
- The dashboard's per-agent UI table is keyed by `AgentName`, so adding an agent here makes a missing dashboard entry a compile error, not a silent gap.

## Facts

- `agentForDriver` maps `claude-code`, `claude-web`, and `github-actions` all to `claude` (#1263): where Claude runs is the run's `target`, not its agent. A driver no agent claims (fake driver, records from newer versions) maps to `undefined`.
