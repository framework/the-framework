`executeToolPhase` — the agent step's tool phase: decides each tool call's fate through a single gate chain, runs `execute()` serially or in parallel, and yields the canonical `tool-call → tool-update* → tool-result` chunk sequence while mutating `loopCtx`/`messages`.

## TLDR

- Entry `executeToolPhase(loopCtx, toolCalls, assistantMessage)`: pushes the assistant message, picks serial vs parallel (`options.parallelTools` ?? `agent.parallelTools()`, forced serial for single-call batches — nothing to gain and serial keeps live updates), then runs `onToolPhaseComplete`.
- `decideToolCall` is the ONE place every gate lives (#971): unknown-tool → handoff-skipped/handoff (checked before the client-tool branch since handoff tools also lack `execute`; first handoff wins, flips `stopForHandoff` so siblings skip) → client tool (placeholder result, or `stop-on-client-tool` ⇒ pending list + `finishReason 'client_tool_calls'`) → `evaluateApproval` (rejected / pending ⇒ `stopForApproval` + `finishReason 'tool_approval_required'`) → `onBeforeToolCall` middleware (skip / abort ⇒ `onAbort` runs / transformArgs) → `validateToolArgs`. Returns a `ready` decision with validated args or one of ten non-ready kinds.
- `haltsToolPhase`: only `pending-approval` and `mw-abort` stop the whole batch; everything else continues to the next call.
- `runToolExecution` drives `executeMaybeStreaming`: yields middleware-filtered `tool-update` chunks; recognizes yielded `pauseForClientTools`/`pauseForApproval` control chunks (mutates loopCtx, returns `paused` — caller SKIPS the tool_result so the yielding call stays orphaned until resume); catches throws into an `error` outcome with duration.
- `emitDecision` / `emitExecutionResult` centralize chunk emission + message pushes + `onAfterToolCall` per decision kind so serial and parallel produce identical observable sequences; `toolResults`/stream chunk carry the ORIGINAL result while the pushed tool message content goes through `applyToModelOutput`.

## Problems

- Parallel execution must keep streamed output deterministic — solved by three phases: serial prelude (all gates resolve in tool-call order; halting decisions stop dispatch), concurrent execution with per-call chunk buffering (`bufferToolExecution`), serial replay in tool-call order.
- Concurrent executions share `ctx`: middleware that WRITES through `ctx` in `runOnChunk` may observe interleaved sibling updates — such apps should set `parallelTools: false` (documented, not guarded).

## Decisions

- Post-execution hook throws (`onAfterToolCall`/`onError` rejecting) are reported as the tool's result in serial but propagate in the parallel replay — deliberately left divergent per #971.
- `loopCtx` mutations happen inside `decideToolCall` (before the decision returns); nothing observes `loopCtx` between mutation and chunk emission, so applying them up front in the parallel prelude is indistinguishable from serial.
- Handoff-skipped siblings get a synthetic "Skipped: parent agent handed off" tool result so the message log stays replay-well-formed.
- Handoff args: validated when possible, but only `args.message` (string) is used as the transition prompt; the `handoff` chunk emits after the tool-call/tool-result pair.

## Flows

- serial: per call `decideToolCall` → (`emitDecision` | `tool-call` chunk → `runToolExecution` yields updates → `emitExecutionResult`) → break on halt.
- parallel: prelude decisions (stop collecting after a halting one) → `Promise.all(bufferToolExecution)` for ready calls → replay per decision in order (buffered updates then result).
