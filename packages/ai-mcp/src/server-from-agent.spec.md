Implements `mcpServerFromAgent()` — wraps an `@gemstack/ai-sdk` `Agent` class as an MCP server that external clients (Claude Desktop, Cursor, …) can connect to.

## TLDR

- Three exposure modes via `opts.expose`: `'tools'` (default, one MCP tool per `agent.tools()` entry), `'agent'` (one synthetic prompt-tool `{ prompt: string } → response.text` that runs the whole agent), `'both'`.
- Returns the SDK's `McpServer` (typed `unknown` behind a structural `SdkMcpServer` slice); caller connects it with an SDK transport (`StdioServerTransport`, etc.).
- Server identity: `opts.name` (default `${AgentClass.name}Server`), `opts.version` (default `'1.0.0'`), `instructions` from `opts.instructions ?? safeInstructions(agent)`.
- Agent tool results are wrapped as a single text content block: strings pass through, `null`/`undefined` → `''`, objects → pretty-printed JSON (`stringifyResult`).
- Streaming agent tools are drained silently — progress yields are dropped and only the final value is returned (v1 limitation; forwarding would need a `progressToken` from the calling MCP client).

## Problems

- Sync-return crash (changeset `6f7cf23`, v0.1.3): the generator check used to be `out instanceof Promise`, so a `.server()` fn returning a bare value or non-native thenable was mistaken for an async generator and died on `iter.next is not a function` (an opaque MCP internal error). `runAgentTool` now duck-types (`next` fn + `Symbol.asyncIterator`) the way `@gemstack/mcp` does.
- Client-only tools (no `execute`) can't be served — `runAgentTool` throws a descriptive error naming the tool.

## Decisions

- `@modelcontextprotocol/sdk`'s `McpServer` is lazily `await import()`ed, keeping the SDK an optional peer.
- `tools()` is opt-in via the `HasTools` interface (abstract `Agent` doesn't declare it); an agent without `tools()` registers zero tools but the prompt-tool path still works.
- The tool's zod `inputSchema` is passed as-is to `registerTool` — the SDK accepts either a ZodRawShape record or a single zod schema.
- `safeInstructions()` treats a throwing `agent.instructions()` as "no instructions" rather than failing server creation, since `instructions()` may depend on per-request state that doesn't exist here.
- The prompt-tool constructs a fresh `new AgentClass()` per call — no conversation state is shared between MCP calls.
- The prompt-tool returns an in-band `[error]` text (not a protocol error) when `prompt` isn't a string.

## Facts

- The SDK does not advertise the `tools` capability until at least one tool is registered, so a tool-less agent exposed with `expose: 'tools'` makes `listTools` fail with "Method not found" — use `expose: 'agent'` for tool-less agents.

## Flows

- build: `mcpServerFromAgent(AgentClass, opts) → new AgentClass() → lazy-import McpServer → new McpServer({name, version}, {instructions}) → registerAgentToolOnServer() per tools() entry (tools|both) → registerAgentPromptToolOnServer() (agent|both) → return server`
- tool call: `MCP tools/call → registered callback → runAgentTool(tool, input) (await promise | drain generator) → stringifyResult() → { content: [{type:'text', text}] }`
- prompt-tool call: `MCP tools/call {prompt} → new AgentClass().prompt(prompt) → { content: [{type:'text', text: response.text}] }`
