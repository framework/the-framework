Converts an ai-sdk agent `StreamChunk` stream into the Vercel AI SDK v4 Data Stream Protocol (`toVercelDataStream` → `ReadableStream<Uint8Array>`; `toVercelResponse` → `Response` with the `X-Vercel-AI-Data-Stream: v1` header) for `useChat()` consumers.

## TLDR

- Prefix mapping: `0:` text delta, `b:` tool-call start, `c:` arg-text delta, `9:` complete tool call, `a:` tool result, `e:`+`d:` finish-step/finish-message (finishReason + `{promptTokens, completionTokens}` usage; `tool_calls` renamed `tool-calls`).
- Chunks with no v4 part (`usage`, `tool-update`, `pending-client-tools`, `pending-approval`, `handoff`) are dropped — use the agent SSE protocol (`toAgentSseResponse`) when a UI needs them.

## Problems

- `c:` parts must be addressed to a toolCallId, but arg-delta chunks from adapters that ship args as bare text deltas (Anthropic, Bedrock) carry no id — resolved index-then-most-recent (`toolCallIndex` map, else last started id), the same routing the agent loop uses (#999).

## Facts

- An `undefined` tool result is null-filled: `JSON.stringify` would drop the key and the client would read the call as unresolved.
- Upstream stream errors propagate via `controller.error(err)`; the stream always closes in `finally`.
