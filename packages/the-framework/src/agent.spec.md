Node-side agent registry: per-agent specs (binary, install hint, cost reporting) and the `createDriver()` factory that turns `--agent` into a real `Driver` (#542).

## TLDR

- Re-exports the node-free vocabulary from `agent-names.ts` so historical import sites keep working.
- `AGENT_SPECS` — per agent: `bin` resolved on PATH, `installHint` shown when preflight cannot find it, `auth` (how to ask the CLI whether it is logged in, #1326), and `reportsCost`.
- `createDriver()` — the one place a run path builds `ClaudeCodeDriver` or `CodexDriver` from an `AgentName`.

## Facts

- Agents are whole coding-agent CLIs driven on the user's own subscription, no API key (#495).
- `reportsCost: false` (Codex) means the spend cap (#322) has no number to gate on and silently never fires — the CLI says so instead of implying a guard (#540).
- `AgentAuthSpec.loggedIn` returns `boolean | undefined`, never just a boolean: exit codes cannot decide this (`claude auth status` prints JSON and exits 0 either way), and an unrecognised answer must read as "could not say" so a wrong "logged out" never blocks a working setup (#1326).
- Codex takes none of the Claude options (its sandbox is its own flag, no MCP config for `--browser`); they are dropped here and reported at the call site so a flag that cannot apply never looks honored.
