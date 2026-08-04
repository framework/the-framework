`mcpServerFromAgent` — expose an `@gemstack/ai-sdk` agent as an MCP server: one MCP tool per agent tool, a single tool that runs the whole agent, or both.

## TLDR

- Three exposure modes: `'tools'` (default), `'agent'` (a synthetic `prompt(text) → text` tool that builds a **fresh agent per call** and runs its loop), `'both'`.
- Returns the official SDK's server (not a `@gemstack/mcp` one) — the bridge stays on the SDK level so it needs nothing from the server-authoring axis. The return type is deliberately `unknown` to avoid a hard SDK dependency.

## Facts

- Client-only tools (no `execute`) are refused with a named error — they cannot be exposed over MCP.
- Generator tools are drained but their progress yields are **dropped** in v1 (forwarding needs a caller-supplied progress token; noted as future work — unlike `@gemstack/mcp`'s runtime, which does forward when a token is present).
- A throwing `instructions()` is treated as "no instructions" rather than failing server creation, since instructions may depend on per-request state.
- An agent without a `tools()` method still works in `'agent'` mode — `tools()` is opt-in on the ai-sdk side too.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
