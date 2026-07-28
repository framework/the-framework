Gemini chat adapter over `@google/genai` — generate + stream with explicit-cache integration (GoogleCacheRegistry), native `google_search`/`fileSearch` tool blocks, and message/tool conversion to Gemini's contents format.

## TLDR

- `GoogleAdapter.buildPayload()` builds the `generateContent(Stream)` payload; when `options.cache` is set it computes a cache key (`buildGoogleCacheKey`) and resolves a `cachedContents/*` resource via the injected `GoogleCacheRegistry`.
- `toGeminiContents()`: system messages → joined `systemInstruction` text; `assistant` → role `model`; assistant toolCalls → `functionCall` parts; tool results → user `functionResponse` parts.
- `toGeminiTools()`: collects plain tools into one `{functionDeclarations: [...]}` entry; `providerHint` tools become native top-level blocks in the same mixed array.
- `mapGeminiFinishReason()` (exported): `MAX_TOKENS` → `length`; `SAFETY`/`RECITATION`/`BLOCKLIST`/`PROHIBITED_CONTENT`/`SPII` → `content_filter`; else `stop` — unless a functionCall was seen, which forces `tool_calls`.

## Problems

- Gemini has no tool-call ids: responses get synthesized ids (`call_<ts>_<rand>`), and `functionResponse.name` must be the *function name* matching the originating `functionCall.name` — a `(toolCallId → name)` map is pre-built from prior assistant messages' toolCalls; unresolvable ids fall back to `'unknown'`. Without this the model sees `name: "call_1234_abc"` and can't pair result with call.
- Gemini reports finishReason `STOP` even on function-call turns, so `tool_calls` is derived from having streamed/parsed a `functionCall` part (`sawFunctionCall`), not from the reason.
- A cached request must only omit what the cache resource actually absorbed: with `{messages: 2}` neither system nor tools were cached, so both still go on the wire; `tools` is deleted from config only when `cache.tools`, `systemInstruction` omitted only when `cache.instructions`.
- `cachedContent` resources can expire between create and use — `generate`/`stream` catch `isNotFoundError`, call `registry.forget(cacheKey)`, rebuild the payload, and retry exactly once.

## Decisions

- `providerHint 'web-search'` → `{google_search: {}}` with no options — Gemini accepts no `allowed_domains`/`max_uses` on this block, so `WebSearch.domains()`/`.maxResults()` are ignored on this provider (documented on WebSearch).
- `providerHint 'file-search'` translates the OpenAI-shaped hint to Gemini's: `vector_store_ids` → `fileSearchStoreNames`, typed `filters` → `metadataFilter` string via `filterToGeminiString`, `max_num_results` → `topK` (#B8.5).
- Unrecognized providerHints fall through to `functionDeclarations` — the schema is still present, worst case the model treats it as a regular function tool.
- PDFs go as `inlineData`; non-PDF documents are base64-decoded to text parts.

## Facts

- The Gemini SDK reads the abort signal from `config.abortSignal` (inside the config block, not a request option).
- Streamed tool calls yield complete `type: 'tool-call'` chunks (not deltas) because Gemini delivers whole `functionCall` parts; no `toolCallIndex` is set.
- Usage comes from `usageMetadata` (`promptTokenCount`/`candidatesTokenCount`/`totalTokenCount`).

## Flows

- generate: `buildPayload()` (cache resolve) → `client.models.generateContent` → `fromGeminiResponse()`; on stale-cache 404 → `forget()` → rebuild → retry once.
- stream: same build → `generateContentStream` (404 retry around the initial call) → per chunk: parts → `text-delta`/`tool-call`; `candidate.finishReason` → `finish` chunk with usage.
