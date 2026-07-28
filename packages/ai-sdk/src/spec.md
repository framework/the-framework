Source of the `@gemstack/ai-sdk` engine: a provider-agnostic agent framework (providers, agent loop, tools, streaming, middleware, memory, evals, budget, computer-use) with colocated `*.test.ts` suites. Themes below; see each subdirectory's `.spec.md` and per-file specs for detail.

## TLDR

- Agent core: `agent.ts` (`Agent`/`ConversableAgent`/`agent()`, step loop, `stepCountIs`/`hasToolCall` stop conditions), `types.ts` (central contracts: messages, `ProviderAdapter`, `Tool`, middleware, usage), `registry.ts` (`AiRegistry` — provider resolution from `provider/model` strings), `facade.ts` (`AI` static facade), `middleware.ts` (hook runners), `output.ts` (structured output via zod), `observers.ts` (event bus, own `./observers` export).
- Tools: `tool.ts`/`tool-helpers.ts`/`tool-execution.ts` (definition builders, schema emission, pause-for-client-tools/approval chunks), `scoped-tool.ts` (capability unions flattened to one schema), `handoff.ts`/`handoffs-driver.ts` (agent-to-agent handoffs), `provider-tools.ts` (`WebSearch`/`WebFetch`/`CodeExecution` provider-native tools), `zod-to-json-schema.ts`.
- Conversation & persistence: `conversation.ts`/`conversation-persistence.ts`/`sanitize-conversation.ts`/`continuation-validation.ts` (`ConversationStore` + validation), `agent-run-store.ts`/`sub-agent-run-store.ts`/`run-store-base.ts`/`resume-approval.ts` (suspendable run state for client-tool/approval pauses), neutral bring-your-own contracts `cache-adapter.ts`/`storage-adapter.ts`/`queue-adapter.ts`, and `queue-job.ts` (queued prompts/broadcast).
- User memory (#A4): `memory.ts`, `memory-inject.ts`, `memory-extract.ts` middleware.
- Streaming protocols: `agent-sse.ts` (named-event agent-SSE protocol: server framers + `readAgentStream` client), `vercel-protocol.ts` (Vercel AI data-stream compat), `chat-mentions.ts` (own export).
- Modalities & assets: `attachment.ts`, `image.ts` (`ImageGenerator`), `audio.ts`/`transcription.ts` (TTS/STT), `files.ts` (`FileManager`), `rerank.ts` (`Reranker`), `base64.ts`.
- RAG: `vector-stores/` (hosted stores, #B8), `file-search.ts` (provider-native RAG tool), `similarity-search.ts` (ORM/pgvector tool, #B7), `cached-embedding.ts`.
- Budget (#A6): `budget/` — pricing catalog, `BudgetStorage`, `withBudget` middleware.
- Eval (#A5): `eval/` — suites, metrics, runner, reporters, fixtures; `fake.ts` (`AiFake` test double powering replay and unit tests).
- Computer-use (#A7): `computer-use/` — Anthropic `computer_20250124` schema, Playwright executor, tool factory.
- Gateway: `gateway/` — `HttpGatewayAdapter` template + SSE framer for custom gateways.
- Runtime splits: `node/` (Node-only path loaders), `react/` (`useAgentRun` hook + framework-free driver), `util/` (content/hash/sleep helpers).
- `providers/` (~20 adapters + tests): `anthropic.ts`+`anthropic-stream.ts`, `openai.ts`+`openai/` (chat, embeddings, files, images, stt, tts, vector-store, prompt-cache), `google.ts`+`google/` (chat, embeddings, files, images, filters, vector-store)+`google-cache-registry.ts` (Gemini `cachedContent`), `bedrock.ts`, `azure.ts`, `openai-compatible.ts` (shared base for `ollama`/`deepseek`/`xai`/`groq`/`mistral`/`openrouter`), `cohere.ts`, `jina.ts`, `voyage.ts`, `elevenlabs.ts` (direct HTTP), `lazy-client.ts` (deferred vendor-SDK client construction).
- `index.ts` is the single main-entry export manifest; `index.test.ts`, `isomorphic-check.test.ts`, and ~45 more colocated `*.test.ts` files cover the above (protocol fixes, approval/suspend/resume, provider quirks).

## Facts

- Isomorphism invariant: the main entry must run in any `fetch`-capable runtime — no `node:` imports outside `node/`, `eval/fixtures.ts`, and test files; `isomorphic-check.test.ts` enforces it. Vendor SDKs are optionalDependencies loaded lazily.
- Persistence is contract-based: `ConversationStore`, `UserMemory`, `BudgetStorage` ship in-memory defaults; `CacheAdapter`, `StorageAdapter`, `QueueDispatch`/`QueueBroadcast` are caller-supplied. ORM implementations live in `@rudderjs/ai`, not here.
- Models are addressed as `provider/model` strings (e.g. `anthropic/claude-sonnet-4-5`); `AiRegistry` resolves adapters and the default.
- Recurring pattern: special tools (handoff, computer-use, file-search) are plain objects tagged with `Symbol.for(...)` markers + structural typeguards, and carry `providerHint`s that let adapters swap in provider-native tool blocks.
- Tests use `node:test`; the suite compiles via `tsconfig.test.json` to `dist-test/` and runs there (`pnpm test`).
