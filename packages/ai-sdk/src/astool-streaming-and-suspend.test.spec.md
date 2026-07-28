Tests for `asTool` streaming projection, client-tool suspend, `Agent.resumeAsTool` client-tool resume, and the sub-agent run stores.

## TLDR

- Zero-config `asTool` (no streaming) still yields a single `AgentResponse` on the parent (1.2.0 behavior unchanged).
- `streaming: true` emits `agent_start` / `tool_call` / `agent_done` as parent `tool-update` chunks; a custom projector function replaces the default.
- `suspendable` without `streaming` throws at builder time.
- Client-tool suspend: parent halts with `finishReason: 'client_tool_calls'`, snapshot stored once with pending ids + user/assistant messages, `subagent_paused` update carries the same `subRunId`.
- Resume: completed path appends the tool result and finishes; paused-again path returns a fresh `subRunId` with accumulated `stepsSoFar`; forgery (unknown `toolCallId`) and missing snapshots reject.
- `CachedSubAgentRunStore` round-trips through an injected `CacheAdapter` with prefixing and atomic consume; `InMemorySubAgentRunStore` consume is single-use and `clear()` drops all.

## Facts

- A tool defined without `.server(execute)` is a client tool — that convention drives the suspend fixtures.
