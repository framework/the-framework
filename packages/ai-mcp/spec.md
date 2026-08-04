`@gemstack/ai-mcp` — the agent ↔ MCP bridge: consume a remote MCP server's tools as `@gemstack/ai-sdk` agent tools (`mcpClientTools`), or expose an agent as an MCP server (`mcpServerFromAgent`).

## TLDR

- Two source files, one direction each: `client-tools.ts` (remote MCP → agent tools) and `server-from-agent.ts` (agent → MCP server). See their `.spec.md` siblings.
- The other MCP package, `@gemstack/mcp`, is the opposite axis: *authoring* servers from scratch. Both can "produce an MCP server", from different inputs — expected overlap, not duplication.

## Decisions

- **Why a separate package**: `@modelcontextprotocol/sdk` used to be a peer of ai-sdk, so every AI consumer saw it although only the MCP bridge used it. Here it is an **optional peer** only this package declares. It was also the cheapest seam to prove the family's carve-out mechanism on.
- **Hard move, no shim**: a re-export shim from `ai-sdk/mcp` would have created the dependency cycle `ai-sdk → ai-mcp → ai-sdk`, breaking the one-directional family rule. External importers were zero at the time, so the subpath was removed outright.
- Every SDK touch is behind `await import`, and every SDK type is a local structural slice or `unknown` — importing this package without the peer installed fails at first *call*, never at module load.

## Facts

- The seam back to ai-sdk is deliberately tiny: one runtime value (`dynamicTool`) plus types; ai-sdk imports nothing back.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
