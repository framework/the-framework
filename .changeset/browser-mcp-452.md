---
"@gemstack/framework": minor
---

Add `--browser`: give the agent a real browser during the run via chrome-devtools-mcp. When set, the driver writes a temp `--mcp-config` wiring `chrome-devtools-mcp`, so the agent can navigate pages, read console + network output, inspect the DOM, and screenshot while it works instead of flying blind on frontend changes. Off by default; host-side only (no runner change), and the MCP servers merge with the user's own rather than replacing them. The `ClaudeCodeDriver` gains an `mcpServers` option backing this.
