Wires an `McpServer`'s declared primitives onto a `@modelcontextprotocol/sdk` `Server` by registering all MCP request handlers; also provides `startStdio`.

## TLDR

- `createSdkServer(server)`: reads metadata + resolver off the server, instantiates every tool/resource/prompt class once via `resolveOrConstruct`, advertises capabilities `{ tools, resources, prompts }`, and registers handlers for `tools/list`, `tools/call`, `resources/list`, `resources/templates/list`, `resources/read`, `prompts/list`, `prompts/get`.
- All list handlers filter through `filterRegistered` (shouldRegister); all call/read/get handlers re-check `isRegistered` so a hidden primitive cannot be invoked directly.
- `tools/call`: `validateInput` against `schema()` (mismatch → `isError` result, not a throw), `resolveHandleDeps`, `consumeToolReturn` (streams progress when `_meta.progressToken` present), emits `tool.called`/`tool.failed` observer events with duration.
- `resources/read`: exact static-URI match first, then first template matching via `matchUriTemplate` (extracted params passed to `handle`); emits `resource.read`/`resource.failed`; unknown URI throws.
- `prompts/get`: validates args when `arguments()` is declared, emits `prompt.rendered`/`prompt.failed`, and adapts `McpPromptMessage.content: string` to the wire's `{ type: 'text', text }` object.
- `startStdio(server)`: `createSdkServer` + `StdioServerTransport` + `connect` + `attachSdk` — no detach, stdio is process-lifetime.

## Decisions

- Error semantics differ by primitive: a thrown tool error becomes an `isError` tool result (`Error: msg` — the client sees a failed call), while resource/prompt errors re-throw as protocol errors after emitting the `*.failed` observer event.
- The `resources/templates/list` handler is only registered when template resources exist.
- `prompts/list` derives arguments from the schema's shape keys and marks every one `required: true`.
- Tool-schema JSON (input and optional output) is produced by `zodToJsonSchema`; tool/resource annotations from the decorators are attached only when present.

## Facts

- Primitive instances are created once per `createSdkServer` call and shared across all requests of that SDK session (stateful web sessions get one set per session; stateless mode one set per request).
- Resource listings set `name` to the URI; durations are `performance.now()` deltas; observer `serverName` comes from `metadata().name`.
