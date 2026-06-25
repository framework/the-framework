---
"@gemstack/ai-mcp": minor
---

Initial release. The agent<->MCP bridge, carved out of `@gemstack/ai-sdk`'s former `./mcp` subpath:

- `mcpClientTools(transport, opts?)` — consume a remote MCP server's tools as `@gemstack/ai-sdk` Agent tools (HTTP URL / stdio spawn / connected SDK client).
- `mcpServerFromAgent(AgentClass, opts?)` — expose an Agent as an MCP server, with `'tools'` / `'agent'` / `'both'` exposure modes.

Depends on `@gemstack/ai-sdk`; `@modelcontextprotocol/sdk` is an optional peer.
