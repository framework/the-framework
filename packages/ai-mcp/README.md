# @gemstack/ai-mcp

The bridge between [`@gemstack/ai-sdk`](https://github.com/gemstack-land/gemstack/tree/main/packages/ai-sdk) Agents and [Model Context Protocol](https://modelcontextprotocol.io) servers. Two connectors:

- **`mcpClientTools(transport, opts?)`** — consume a remote MCP server's tools as Agent tools.
- **`mcpServerFromAgent(AgentClass, opts?)`** — expose an Agent as an MCP server external clients (Claude Desktop, Cursor, etc.) can call.

This is the **agent bridge** axis of MCP. It depends on `@gemstack/ai-sdk` and is useless without an Agent. It was carved out of `@gemstack/ai-sdk`'s `/mcp` subpath so the optional MCP SDK dependency is declared only by the package that actually needs it.

## Which MCP package do I use?

> **Exposing an existing Agent, or feeding remote MCP tools into one?** Use `@gemstack/ai-mcp` (this package).
> **Authoring an MCP server from scratch** (tools / resources / prompts / auth)? Use a standalone MCP server framework — that is a separate, agent-agnostic concern, not this bridge.

Both can "produce an MCP server", but from different inputs: `mcpServerFromAgent(anAgent)` versus a hand-authored server. That overlap is expected, not duplication.

## Installation

```bash
pnpm add @gemstack/ai-mcp @modelcontextprotocol/sdk
```

`@modelcontextprotocol/sdk` is an **optional peer dependency** — install it when you use this bridge. `@gemstack/ai-sdk` comes in as a regular dependency.

## Usage

### Consume a remote MCP server's tools

```ts
import { mcpClientTools } from '@gemstack/ai-mcp'

// (a) HTTP — string URL or URL instance
const tools = await mcpClientTools('https://api.example.com/mcp')

// (b) Local stdio subprocess
const tools = await mcpClientTools({ command: 'npx', args: ['some-mcp-server'] })

// (c) Already-connected SDK Client (caller owns lifecycle)
const tools = await mcpClientTools(myClient)

// Spread into your Agent's tools(). Call tools.close() when done (cases a + b).
```

### Expose an Agent as an MCP server

```ts
import { mcpServerFromAgent } from '@gemstack/ai-mcp'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

const server = await mcpServerFromAgent(MyAgent)
await server.connect(new StdioServerTransport())
```

Three exposure modes via `opts.expose`: `'tools'` (default, one MCP tool per `agent.tools()` entry), `'agent'` (one tool that runs the whole agent: `prompt(text) → text`), or `'both'`.

## License

MIT
