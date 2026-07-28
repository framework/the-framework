Named-event SSE protocol for streaming an agent loop to a browser — both the server encoder and the browser decoder live in one module so the wire vocabulary cannot drift.

## TLDR

- Wire vocabulary (`AgentSseEventName`): `text`, `tool_call`, `tool_update`, `tool_result`, `pending_client_tools`, `tool_approval_required`, `handoff`, `complete`, `error`.
- Server: `toAgentSseStream()` projects an `AgentStreamResponse` chunk-by-chunk onto `event: <name>\ndata: <json>\n\n` frames, then awaits `response` and emits a terminal `complete` (`done`, `finishReason`, `awaiting`, step count, usage); errors become an `error` event followed by a clean close. `toAgentSseResponse()` wraps it with `text/event-stream` headers.
- Browser: `readAgentStream(resp, callbacks)` decodes frames back into an accumulated `AgentStreamTurn` (assistant text, tool calls, server tool results, pending client tools/approval, handoff path, done/awaiting) and fires per-event callbacks; `applyAgentSseEvent()` is the exported per-event reducer for unit testing.
- `awaitingFor()` maps `finishReason` `client_tool_calls` → `awaiting: 'client_tools'` and `tool_approval_required` → `'approval'`.

## Problems

- SSE frames can split across `read()` boundaries — the decoder buffers partial lines and hoists `currentEvent` across reads.
- Malformed event JSON must be skipped without also swallowing consumer-callback bugs: `JSON.parse` runs inside the try/catch, `applyAgentSseEvent` (which invokes callbacks) runs outside it.

## Decisions

- Runtime-agnostic on purpose: only web globals (`ReadableStream`, `Response`, `TextEncoder/Decoder`, `crypto.randomUUID`), no `node:` imports — safe in the main entry, server- and client-side.
- This is the alternative to the Vercel data-stream protocol (`toVercelDataStream`, numeric-prefix wire) for apps wanting self-describing event names.
- `tool-call-delta` / `usage` / `finish` chunks carry no named event — the terminal `complete` reports finish reason + usage from the resolved `AgentResponse`.
- Unknown event names route to `onAppEvent` and leave turn state untouched — apps layer their own events (e.g. `run_started` with a `runId`) on the same stream.
- The caller owns `fetch` and the `!resp.ok` branch; `readAgentStream` expects an already-OK response, and a bodyless response resolves to an empty turn.
- Tool results pass strings through verbatim, everything else is JSON-encoded into `content`.

## Facts

- Response headers set: `Content-Type: text/event-stream; charset=utf-8`, `Cache-Control: no-cache, no-transform`, `Connection: keep-alive`, `X-Accel-Buffering: no` (disables nginx buffering).
- The decoder generates a random tool-call id when the wire omits one, and drops `tool_result` events with no id.
- `handoffPath` accumulation seeds `from` only on the first handoff event, then appends each `to`.
