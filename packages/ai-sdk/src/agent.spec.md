The core of the SDK: the abstract `Agent` base class and the multi-step tool-calling loop (non-streaming + streaming), including sub-agent composition (`asTool` / `resumeAsTool` / `resumeManyAsTool`), handoff driving, failover, middleware hooks, auto-persist and memory cascades.

## TLDR

- `Agent` (abstract): subclasses override `instructions()` (required) plus optional `model()`, `failover()`, `maxSteps()` (20), `stopWhen()`, `temperature()`, `maxTokens()`, `cacheable()`, `conversational()`, `remembers()`, `parallelTools()`, `prepareStep()`, `tools()`, `middleware()`.
- Entry points: `prompt()` (non-streaming), `stream()`, `queue()` (returns `QueuedPromptBuilder`), `forUser()`/`continue()` (returns `ConversableAgent` wrapper), `asTool()` (wrap agent as a tool for a parent agent).
- `agent(instructionsOrOptions)` factory builds an inline `AnonymousAgent`.
- Shared `LoopContext` struct + helpers (`initializeLoop`, `runIterationPrelude`, `runFailover`, `buildAgentResponse`, observer emitters) serve both `runAgentLoopOnce` and `runAgentLoopStreamingOnce` so prompt/stream behave identically.
- Handoffs: `runAgentLoop`/`runAgentLoopStreaming` wrap the once-loops; a `_pendingHandoff` on the internal response pivots to the child agent (via `handoffs-driver.ts`) up to `MAX_HANDOFFS`, merging steps/usage and recording `handoffPath`.
- Stop conditions: `stepCountIs(n)` / `hasToolCall(name)` combinators; arrays OR together.
- Global registries: `setConversationStore`/`resolveConversationStore`, `setUserMemory`/`resolveUserMemory`; observers read from `globalThis.__rudderjs_ai_observers__` and receive `agent.step.completed` / `agent.completed` / `agent.failed` events.
- Exports `mergeUsage` (internal, for tests) and re-exports `PendingHandoff`, `InvalidToolArgumentsError`.

## Problems

- Streaming usage aggregation: providers emit usage across multiple chunks per step (Anthropic `message_start` = prompt, `message_delta` = completion); `mergeUsage` takes MAX per field (safe because chunks are running snapshots) instead of last-wins which dropped prompt counts and undercharged billing.
- Parallel tool-call arg streaming: OpenAI interleaves ≥2 tool calls' arg fragments by `toolCallIndex`; partials are tracked in both an id-keyed and an index-keyed map — the old "pop last partial" heuristic silently attached fragments to the wrong call. Fallback to most-recent partial only for adapters without index.
- Abort correctness: a caller `AbortSignal` is checked at loop entry and between iterations, short-circuits failover (abort must not trigger the next model), and the streaming outer wrapper rejects the `response` promise before re-throwing — otherwise `await response` would hang forever after a mid-stream abort. The handoff stream also attaches a no-op `.catch()` to inner responses to avoid unhandledRejection between throw and catch.
- Double side effects on streaming setup: `conversational()`/`remembers()` are invoked exactly once and threaded into the async path — re-calling would repeat DI/DB lookups and leave the first promise unhandled if it rejects. A synchronous fast path skips the async wrapper (one microtask) when both are provably no-ops.
- Suspend/resume forgery: `resumeAsTool` validates every incoming `toolCallId` against the snapshot's pending set, rejects duplicates, rejects `clientToolResults` on approval snapshots, and requires approve/reject ids for approval pauses; `consume()` is single-use so a replayed `subRunId` throws "expired or never existed".

## Decisions

- `asTool` defaults: `inputSchema` `{ prompt: string }`, parent model sees only `response.text` (`modelOutput` override), UI still gets the full `AgentResponse` via the `tool-result` chunk. `suspendable` requires `streaming` (throws otherwise — silent suspend would leave the parent UI without progress).
- Suspend snapshots are replay-ready message histories (`buildSubAgentSnapshotMessages` / `buildResumeSnapshotMessages`), system message omitted because messages-mode re-prepends it; each resume issues a FRESH `subRunId` and accumulates `stepsSoFar`/`tokensSoFar`; a resume may pause again on a different kind (approval → client_tool).
- `resumeManyAsTool` batches resumes with `onError: 'capture'|'throw'` and `concurrency: 'parallel'|'serial'` (parallel safe because `consume()` is per-id atomic); aggregates `paused`/`completed`/`errors` + flattened `pendingToolCallIds`; loop until `allCompleted`.
- `defaultSubAgentProjector` only surfaces `tool_call` and `agent_pending_approval` updates; `agent_start`/`agent_done`/`subagent_paused*` bookends come from the wrapping generator; custom `ChunkProjector` receives a `ctx` with `originalSubRunId`/`key` on resume paths for fan-out.
- Auto-installed middlewares (memory inject/extract) plumb through options under `Symbol.for('rudderjs.ai.extraMiddlewares')` to avoid polluting the public `AgentPromptOptions`; memory cascade runs BEFORE conversation persistence and is skipped entirely on continuation calls (`options.messages` set) to avoid re-injecting/re-extracting per tool round-trip.
- `resolveCacheMarkers`: per-call `cache: false` disables, per-call config replaces `agent.cacheable()`; a `ttl` with no region markers is dropped as meaningless.
- Approval resume that still requires approval skips the model loop entirely (`stopForApproval` set by `resumePendingToolCalls` during `initializeLoop`).
- Non-streaming loop drains `executeToolPhase`'s generator discarding chunks; the streaming loop forwards them — one shared tool phase implementation.
- `ConversableAgent.toSpec()`: explicit `forUser`/`continue` bypass `conversational()` entirely; bare `continue()` yields an empty user (legal for ownerless threads, refused by the owner check for owned ones, #984); resolved `conversationId` is tracked back onto the wrapper for follow-up calls.

## Facts

- Message layout: `[system(instructions), ...history?, user(input+attachments)]`, or `[system, ...options.messages]` in continuation mode.
- Loop stops when a stop condition fires, `finishReason !== 'tool_calls'`, or `stopForClientTools`/`stopForApproval`/`stopForHandoff` is set by the tool phase; streaming emits `pending-client-tools` / `pending-approval` chunks after the loop.
- `runFailover` tries `[model, ...failover()]` in order, increments `failoverAttempts` (reported to observers), and re-throws the last error; abort reasons propagate immediately.
- `prepareStep` may override `model`, replace `messages`, or swap the system message per iteration; middleware `onConfig` runs at `init` and `beforeModel` phases and can rewrite messages (spliced in place).
- Middleware hook order per run: onConfig(init) → onStart → per-iteration [onIteration → onConfig(beforeModel) → model → onUsage → tool phase] → onFinish; onError + observer `agent.failed` on throw; middleware `ctx.abort()` triggers `runOnAbort` and breaks the loop.
- Streamed partial tool-call args are `JSON.parse`d at step end; parse failure degrades to `arguments: {}`.
- `AgentResponse.text` is the LAST step's message text; `_pendingHandoff`/`_carriedMessages` are internal fields stripped by `stripInternal` before reaching public callers.

## Flows

- prompt: `prompt()` → memory auto-cascade → `resolveAutoPersistSpec` → [`runWithPersistence`] → `runAgentLoop` → `runAgentLoopOnce` (init → iterate: prelude → `runFailover(adapter.generate)` → `executeToolPhase` → step/observers) → handoff pivot? → `AgentResponse`.
- stream: `stream()` → fast path or async outer (memory cascade → persistence) → `runAgentLoopStreaming` → per-hop `runAgentLoopStreamingOnce` (chunks forwarded, partial tool calls assembled, pending chunks emitted) → resolve `response`.
- sub-agent dispatch: parent tool call → `asTool` generator: `agent_start` → inner `stream()` chunks projected to `SubAgentUpdate`s → on inner pause + `suspendable`: store snapshot, yield `subagent_paused[_approval]` + `pauseForClientTools`/`pauseForApproval` → parent halts; else `agent_done` + return `AgentResponse`.
- sub-agent resume: `resumeAsTool(subRunId, results)` → `consume` snapshot → validate ids per `pauseKind` → re-enter `prompt()`/`stream()` in messages mode → `completed` | `paused` (new snapshot, fresh id); `resumeManyAsTool` fans out over requests and aggregates.
