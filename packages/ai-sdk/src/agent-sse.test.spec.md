Tests for `agent-sse.ts` — covers server-side SSE framing, header setting, and full round-trips through `readAgentStream` / `applyAgentSseEvent`.

## TLDR

- Framing of text/tool_call/tool_result plus terminal `complete`; client-tool and approval pauses map to `awaiting` values.
- Round-trip decoding: byte-by-byte sliced bodies (frames spanning reads), malformed-JSON skip, bodyless response → empty turn.
- Consumer-callback errors must propagate (the malformed-JSON guard must not eat them); `error` events fire `onError`.
- Reducer details: handoff chain accumulation, generated tool-call id when the wire omits one, orphan tool_result ignored, unknown events routed to `onAppEvent` without touching turn state.
