Source of `@gemstack/ai-mcp`: the two Agent⇄MCP bridge functions plus shared types and their test suites.

## TLDR

- `index.ts` — entry barrel re-exporting both bridges + public types.
- `client-tools.ts` — `mcpClientTools()`: remote MCP tools → Agent `Tool`s (HTTP / stdio-spawn / existing Client), with live progress streaming and lifecycle `close()`.
- `client-tools.test.ts` — loopback + fake-client tests; pins live streaming (#977) and connect-failure cleanup (#978).
- `server-from-agent.ts` — `mcpServerFromAgent()`: Agent → MCP server with `'tools' | 'agent' | 'both'` exposure modes.
- `server-from-agent.test.ts` — tools-mode suite (incl. sync-return regression).
- `server-from-agent-modes.test.ts` — agent/both-mode suite driven by a scripted provider adapter.
- `types.ts` — public option/transport types, SDK-dependency-free.

## Facts

- Invariant across the directory: `@modelcontextprotocol/sdk` is never statically imported by shipped code — only dynamic `import()` plus structural (`MinimalClient`/`SdkMcpServer`) types — so it stays an optional peer. Tests import it statically (it's a devDependency).
- Tests run compiled: `tsc -p tsconfig.test.json` then `node --test` in `dist-test/`, all against real in-memory MCP transports (`InMemoryTransport.createLinkedPair()`), not mocks of the protocol.
