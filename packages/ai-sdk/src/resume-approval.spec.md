`resumePendingToolCalls` — fulfills the unmatched `toolCalls` on the trailing assistant message when a chat continues after a stop-on-approval round-trip, executing approved server tools and appending their tool messages in place.

## TLDR

- Strips trailing `_pending: true` placeholder tool messages from a prior partial resume, finds the parent assistant (most recent assistant followed only by tool messages), and collects already-resolved call ids (non-pending trailing tool messages) to avoid double-executing.
- Walks the parent's `toolCalls`: unknown tool ⇒ error message; client tool (no `execute`) ⇒ "not executed by the browser" error so the model can recover; rejected ⇒ `{rejected:true,...}` JSON; still-pending ⇒ record `approvalStillRequired`, synthesize `_pending` placeholder tool messages for EVERY unresolved sibling, and stop; approved ⇒ validate args, run `executeMaybeStreaming` draining yields silently, apply `toModelOutput`, push a real tool message (execute throws become `Error: …` content).
- Returns `{ resumed, approvalStillRequired }`; caller attaches `resumed` to `AgentResponse.resumedToolMessages` so the dispatcher persists them.

## Problems

- Anthropic rejects any conversation where a `tool_use` lacks a matching `tool_result` — a paused multi-call approval batch would 400 on the next request. Placeholders keep the invariant while paused; the next resume strips them and re-walks with fresh approval state.
- Partial approvals across multiple round-trips must not re-execute already-approved tools — solved by the `alreadyResolved` id set.

## Decisions

- Approval-resume runs outside the stream and without middleware: generator yields are discarded, and `toModelOutput` errors fall back silently to default stringification (R6).
- Args are validated with the raw `tc.arguments` (middleware transforms don't apply here); validation failure feeds the structured error to the model rather than executing.

## Facts

- `_pending` on `AiMessage` is internal-only and never reaches the wire as a real result (stripped-and-rewalked on each resume).
