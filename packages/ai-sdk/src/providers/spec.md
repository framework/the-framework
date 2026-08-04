The provider adapters: one two-method contract (`generate`, `stream` → chunks) behind factories with optional capability methods (embeddings, images, TTS/STT, rerank, files, vector stores).

## TLDR

- Full hand-written chat adapters: Anthropic, OpenAI, Google, Cohere, Bedrock (which wraps Anthropic's event format 1:1 and reuses every Anthropic converter). Generated OpenAI-compatible wrappers (~a dozen lines each): xAI, Groq, DeepSeek, Ollama, Azure. Hand-written because they add behavior: Mistral (embeddings), OpenRouter (analytics headers; its model ids keep their own vendor prefix — model strings split on the *first* slash). Non-chat specialists whose chat `create()` throws: Voyage, Jina, ElevenLabs (raw fetch, no SDK).
- `lazy-client.ts` is tiny but load-bearing: every adapter builds its SDK client through it — the in-flight promise is memoized (two concurrent first calls share one client), rejection drops the cache (a transient import failure doesn't poison later calls), and a setter is the test seam that avoids the dynamic import.
- Provider-native tool substitution rides `providerHint`: computer use and web search on Anthropic, file search on OpenAI/Google, Google's search grounding — adapters that don't recognize a hint fall back to the generic function tool.

## Facts

- `anthropic-stream.ts`: Anthropic splits prompt and completion token counts across two events, so the mapper carries the prompt count in cross-event state into the final chunk. Without it, streamed calls report zero prompt tokens and **budgets silently undercharge every streamed call**.
- `openai/prompt-cache.ts`: OpenAI caches automatically above a size threshold; the only knob is a routing-affinity key, built by hashing exactly the regions the agent marked cacheable — stability, not secrecy, is the goal.
- `openai/chat.ts` (`normalizeToolTranscript`): OpenAI-compatible hosts require each tool message to immediately follow the assistant message declaring its id — the normalizer re-orders, synthesizes clearly labeled stub results for missing ones, and drops orphans; well-formed transcripts pass through untouched.
- `google-cache-registry.ts`: Gemini's cached content is a **stateful server resource** (unlike Anthropic's ephemeral markers or OpenAI's automatic prefix cache), so a registry maps cache keys to resources, dedupes concurrent creates, memoizes "prompt too small" refusals for a few minutes, and on a stale-resource 404 forgets the key and retries exactly once.
- Node-only I/O in file/vector-store paths hides behind `await import('node:fs' as string)` — the cast defeats static analysis so the isomorphic-entry check stays honest about the main path.
- Hosted vector stores exist only on OpenAI and Google (and Google's not on Vertex).

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
