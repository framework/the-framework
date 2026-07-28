Global MCP observer registry — collectors (e.g. Telescope) subscribe to structured events emitted when tools, resources, and prompts are invoked.

## TLDR

- `McpObserverEvent`: `kind` (`tool.called|failed`, `resource.read|failed`, `prompt.rendered|failed`), `serverName`, `name` (tool name / resource URI / prompt name), `input`, `output` (null on failure), `duration` (wall-clock ms), `error?` on `*.failed`.
- `subscribe(fn)` returns an unsubscribe function; `emit()` wraps each observer in try/catch — an observer bug must never break an MCP server; `reset()` clears all.
- Singleton `mcpObservers` is stored on `globalThis.__gemstack_mcp_observers__`.

## Decisions

- `globalThis` singleton (same architecture as `@gemstack/ai-sdk/observers`) so registry state survives Vite SSR module re-evaluation — a module-local instance would be silently duplicated per re-eval.
