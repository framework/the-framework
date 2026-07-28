Tool authoring core: `toolDefinition`/`dynamicTool` builders (`ToolBuilder` → `ServerToolBuilder`), zod→provider schema conversion (`toSchema`/`toolToSchema`), and the two `__rudderjs`-discriminated pause control chunks a server tool can yield to suspend the parent loop.

## TLDR

- `ToolBuilder` IS a valid client tool (`execute` intentionally absent); `.server(execute)` returns a `ServerToolBuilder` (also a valid `Tool` — no `.build()` step) accepting plain async or `async function*` executes; `.modelOutput(fn)` is a chained refinement returning a new builder with `toModelOutput` set.
- `toSchema`/`toolToSchema`: `jsonSchema` (pre-built, e.g. MCP imports) takes precedence over `zodToJsonSchema(inputSchema, 'input')`; `providerHint` is propagated so adapters can substitute native blocks (computer-use, file-search, web-search).
- `pauseForClientTools(toolCalls, resumeHandle?)` / `isPauseForClientToolsChunk`: yielded from a generator execute, makes the loop append the calls to the parent's pending list, stop with `client_tool_calls`, and NOT emit a tool_result for the yielding call (it stays orphaned until continuation).
- `pauseForApproval(toolCall, isClientTool, resumeHandle?)` / `isPauseForApprovalChunk`: sibling for the `tool_approval_required` case — sets `pendingApprovalToolCall` and stops, skipping the tool_result the same way.

## Decisions

- Pause is a YIELD, not a throw: symmetric with the `tool-update` protocol, observable by `runOnChunk` middleware, and not an error semantically; any server tool can use it (geolocation/clipboard/file-upload), not just nested agent runners.
- Typeguards are structural on the reserved `__rudderjs` discriminator so tool authors need no ai-sdk import at the yield site; the factory helpers keep future shape changes source-compatible.
- `.server()` overload order matters: the generator overload MUST come first or TypeScript binds `TReturn = AsyncGenerator<...>` for `async function*` executes and leaks the wrapper type into `.modelOutput` (regression covered in index.test.ts).

## Facts

- State needed to resume the inner work is the TOOL's responsibility (runStore/cache); the loop only propagates the pause — `resumeHandle` is opaque and never inspected.
- Primary pause consumer today: nested agent runners (`run_agent` in panels) whose sub-agent hits a client tool or approval gate.
