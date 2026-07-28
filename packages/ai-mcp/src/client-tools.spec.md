Implements `mcpClientTools()` — connects to a remote MCP server and surfaces its tools as `@gemstack/ai-sdk` `Tool`s an Agent can call.

## TLDR

- Accepts three transport shapes: string/`URL` (Streamable HTTP), `StdioServerSpawn` `{ command, args?, env?, cwd? }` (spawns a subprocess), or an already-connected SDK `Client` (detected by duck-typing `callTool` + `listTools`; caller keeps lifecycle ownership).
- Returns `McpClientToolsHandle`: a `ReadonlyArray<Tool>` that carries a non-enumerable `close()` only when this call created the client (HTTP/stdio cases) — non-enumerable so spreading into `tools()` / for-of iteration never sees it.
- Each remote tool becomes a `dynamicTool` with `inputSchema: z.unknown()` as placeholder; the remote server's JSON Schema ships verbatim to providers via `jsonSchema` — no zod↔JSON-Schema conversion in either direction.
- Streaming mode (default `true`) wires the SDK's `onprogress` callback into an async-generator tool: each `notifications/progress` payload is yielded live as a tool-update chunk while `callTool()` is still pending.
- `mcpContentToString()` flattens the MCP result for the agent's `tool_result` slot: text blocks concatenate with `\n`; image/resource blocks become `[image: <mime>]` / `[resource: <uri>]` placeholders; `isError` results become `[error] <text>`; empty → `(empty result)`.
- `opts.filter(name)` drops tools; `opts.namePrefix` prefixes the local tool name only (remote call still uses the original name).

## Problems

- Live progress vs. ordering (#977, changeset `585e545`): progress used to be collected and replayed only after `callTool()` resolved, so a progress bar jumped from empty to complete. Now a pending-queue + `wake` resolver yields each notification as it lands, while still guaranteeing every chunk is drained before the tool's final result (the generator only returns after the call settles and one last drain).
- Connect-failure leak (#978, changeset `585e545`): the MCP SDK does not clean up when `transport.start()` rejects and only fires an unawaited `close()` on initialize failure, so a failed `connect()` orphaned the stdio subprocess / HTTP session — one leak per retry. `connectOrClose()` closes both the client and the transport best-effort and rethrows the original error.
- The `callTool` promise in the streaming generator is settled via `.then(ok, fail).finally(...)` into flags (`settled`/`failed`/`result`/`failure`) so it never rejects unhandled; the outcome is replayed after the queue drains.
- A `listTools()` failure after a successful connect closes the owned client before rethrowing (no leak on the enumeration path either).

## Decisions

- `@modelcontextprotocol/sdk` is only ever `await import()`ed (Client, StreamableHTTPClientTransport, StdioClientTransport) so it can stay an optional peer dependency — apps not using the bridge never load or install it.
- The SDK `Client` is never named in types; a structural `MinimalClient` interface (`listTools`/`callTool`/`close`) is asserted via a deliberate `unknown` double-cast, keeping the package free of a hard SDK type dependency.
- `connectOrClose` is exported `@internal` for tests only — not re-exported from the package entry.

## Facts

- Client info advertised on connect: `{ name: 'gemstack-ai-mcp-bridge', version: '1.0.0' }`.
- `close()` on the handle is non-enumerable and non-writable (`Object.defineProperty`); absent entirely for a caller-owned client.

## Flows

- setup: `mcpClientTools(transport) → resolveClient() (duck-type Client | lazy-import SDK → buildTransport() → connectOrClose()) → client.listTools() → opts.filter → buildTool() per remote tool → handle (+ non-enumerable close() when owned)`
- streaming call: `execute(input) → client.callTool({name, arguments}, undefined, {onprogress: push+wake}) → loop: yield queued progress / await wake → call settles → final drain → throw failure | return mcpContentToString(result)`
- non-streaming call: `execute(input) → client.callTool() → mcpContentToString(result)`
