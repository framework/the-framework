Validates that a client-supplied continuation is a legitimate extension of the server-persisted history — defends the auto-persist/continuation path against forged conversations.

## TLDR

- `validateContinuation(persisted, incoming, opts)`: pure, synchronous, never throws; returns `{ ok }` or `{ ok: false, code, reason, index? }`.
- Three checks in order: prefix equality over the shared region (`not-a-prefix` = rewritten history / IDOR replay), every incoming `tool` message must answer a tool call some assistant actually requested (`forged-tool-result` = smuggled data), and every approved/rejected id must reference a real requested call (`forged-approval`).
- `assertValidContinuation` throws `ContinuationValidationError` (carries `code` + `index`); `defaultContinuationValidator()` adapts it to the `ContinuationValidator` hook consumed by `AgentPromptOptions.validate`.

## Problems

- Serialization boundaries reorder object keys (Postgres `jsonb` does not preserve key order; clients rebuild objects) — comparison canonicalizes recursively (sorted keys, `undefined` dropped) so a reordered tool-call `arguments` map is not mistaken for a forgery.

## Facts

- `messageDiffReason` compares role, content (order-insensitive), `toolCallId`, and each assistant `toolCalls` entry (id, name, canonical arguments), and names the first diverging field in the rejection reason.
- `index` points into `incoming` for `not-a-prefix`/`forged-tool-result`; absent for `forged-approval` (the id is named in `reason`).
- Requested-call ids are collected across BOTH persisted and incoming assistant messages, so a continuation may answer calls issued within itself.
