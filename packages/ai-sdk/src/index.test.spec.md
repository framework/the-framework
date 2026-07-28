Main integration/unit suite for the package core — registry, providers, tool system, agent loop, middleware, output, conversations, facade, caching, failover, fakes, approvals, and parallel tools (all against mock/scripted provider adapters; no network).

## TLDR

- `AiRegistry`: register/resolve, `parseModelString`, default model, `reset()`; store lives on `globalThis.__rudderjs_ai_registry__` so a second bundled copy of the package still sees registered factories.
- Prompt-caching plumbing: Anthropic `applyCacheToSystem/Tools/Messages` add `cache_control: {type:'ephemeral'}` to the last block of each marked region; OpenAI `buildPromptCacheKey` hashes only marked regions into a stable hex `prompt_cache_key` (undefined when markers empty); agent forwards `cacheable()` markers, per-call `cache: false`/config overrides, floors `messages` to an int, omits all-falsy configs.
- Tool system: `toolDefinition().server()` vs client tools (no execute), `needsApproval`, `lazy`, zod→JSON Schema conversion, `dynamicTool`.
- Agent loop: multi-step tool execution, `asTool` sub-agents (default `{prompt}` schema, custom `inputSchema`+`prompt` mapper, `modelOutput` summarizer), `stepCountIs`/`hasToolCall`, failover, `pauseForClientTools` yielded from a server tool bubbles nested client calls + `finishReason:'client_tool_calls'` with NO tool_result for the yielding call, `ToolCallContext.toolCallId` passed to execute.
- Middleware runners: piped `onConfig`/`onChunk` (null drops), first-wins `onBeforeToolCall` (skip/transformArgs/abort), sequential everything else.
- Client tools + approvals: placeholder mode (default) vs `stop-on-client-tool`; `needsApproval` stops with `tool_approval_required` without executing; approval continuation via `options.messages` + `approvedToolCallIds`/`rejectedToolCallIds` produces `resumedToolMessages`; streaming emits `pending-client-tools`/`pending-approval` chunks.
- Async-generator executes: `tool-update` chunk per yield (ordered tool-call → updates → tool-result), drained silently under `prompt()`; middleware `onChunk` observes updates; `.modelOutput()` narrows only the next-step model input (UI/toolResults/stream keep the original; throwing formatter falls back to stringify + routes through `onError`); generator overload infers the RETURN type (TS overload-order regression).
- Arg validation: structured `invalid_arguments` fed back to the model without executing; zod defaults/transforms applied before execute; validated on approval-resume too; duration 0 on skipped paths.
- AbortSignal: pre-aborted rejects before any provider call, mid-run abort honored at iteration boundaries, signal forwarded into `ProviderRequestOptions`.
- Observers: `agent.completed` carries real wall-clock tool durations (also on error), `agent.step.completed` fires per iteration before `agent.completed` with cumulative tokens, streaming flag set.
- Parallel tools (default on): concurrent execute with enters-before-exits invariant, chunk replay in tool-call order, per-call `parallelTools:false` and agent-level `parallelTools()` overrides, sibling isolation on throw, approval-pending halts the batch after earlier results.
- `ConversableAgent`/`forUser`/`continue`: creates/loads threads, appends only new messages, persists tool messages, streaming variant persists too; errors without a registered store.
- Media failover: Image/Audio/Transcription try candidates in order, skip capability-missing providers, `store()` writes via `StorageAdapter`.
- `AiFake`: `respondWith`, `respondWithSequence` (resets call counter), `failOnStep`, `preventStrayPrompts` (also streaming), `getCalls`, assertions.

## Facts

- Scripted fake (`installScriptedFake`) registers a `__loop_test__` provider consuming a `_script` array — one entry per provider round-trip; used by all loop-behavior suites.
- The pause-chunk contract deliberately uses yields, not throws, so middleware `runOnChunk` observes pauses and telemetry stays clean.
- Parallel-tool concurrency asserts the invariant "both enters before either exit" rather than exit order (Windows ~15ms timer quantum makes exit order flaky).
