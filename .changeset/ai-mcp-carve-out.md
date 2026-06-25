---
"@gemstack/ai-sdk": minor
---

Remove the `./mcp` subpath. The agent<->MCP bridge (`mcpClientTools` / `mcpServerFromAgent`) has moved to its own package, `@gemstack/ai-mcp`, so the optional `@modelcontextprotocol/sdk` peer dependency is now declared only by the package that uses it (and no longer surfaces to every `@gemstack/ai-sdk` consumer).

Migration: replace `@gemstack/ai-sdk/mcp` imports with `@gemstack/ai-mcp`, and move the `@modelcontextprotocol/sdk` peer to that package. The bridge API is unchanged.
