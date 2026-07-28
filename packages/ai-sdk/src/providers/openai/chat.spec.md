OpenAI Chat Completions adapter — generate + stream with tool-transcript normalization for OpenAI's strict tool-call protocol, native `file_search` tool emission, and `prompt_cache_key` support; reused verbatim by every OpenAI-compatible provider (Ollama, Groq, DeepSeek, xAI, Azure, Mistral, OpenRouter).

## TLDR

- `OpenAIAdapter.generate/stream`: builds `chat.completions.create` params from `ProviderRequestOptions`; attaches `prompt_cache_key` from `buildPromptCacheKey(messages, tools, options.cache)`.
- `normalizeToolTranscript()` (exported) repairs tool-call ↔ tool-result adjacency in both directions before serialization.
- `toOpenAITools()`: `providerHint 'file-search'` → native `{type:'file_search', vector_store_ids, filters?, max_num_results?}` block (server-side search, trained-on tool, no client execute); everything else → `{type:'function', function:{...}}`.
- `mapOpenAIFinishReason()` (exported): `tool_calls`/`function_call` → `tool_calls`, `length`, `content_filter`, else `stop` — without it a max-tokens truncation reads as a clean stop.

## Problems

- OpenAI (and strict implementers like DeepSeek) 400 when a `role:'tool'` message doesn't immediately follow the assistant message declaring its `tool_call_id`, or when a declared `tool_calls` entry goes unanswered. Persist→resume cycles (client-tool pause, approval round-trips, apps re-storing assistant turns without `toolCalls`) violate this — `normalizeToolTranscript` pulls detached results adjacent in declaration order, synthesizes stub results for unanswered calls (mirrors `resumePendingToolCalls`), and drops orphan results whose call id no assistant declares. See `docs/plans/2026-06-11-deepseek-tool-transcript-400.md`.
- Streamed usage: OpenAI omits usage unless `stream_options: {include_usage: true}` is sent — without it streamed calls report nothing to budget accounting. The usage-bearing chunk arrives last with an EMPTY `choices` array, so it must be read before the `if (!choice) continue` guard; the `finish` chunk is emitted after the loop because usage lands on a later chunk than `finish_reason`.
- Parallel tool calls: `tc.index` is the only stable correlator between the id-carrying start delta and later arg-only deltas — threaded through as `StreamChunk.toolCallIndex` so the agent loop routes fragments to the right partial.

## Decisions

- Result lookup uses a FIFO queue per `tool_call_id`, tolerating pathological duplicate ids without dropping messages; already-valid transcripts pass through with the same object references (linear scan only).
- PDFs are sent as `{type:'file'}` parts, images as base64 data-URL `image_url`, other documents decoded to text.
- Assistant messages with toolCalls send `content: null` when text is empty.

## Facts

- Tool arguments are JSON.stringified on requests and JSON.parsed on responses (OpenAI's wire format is a JSON string).
