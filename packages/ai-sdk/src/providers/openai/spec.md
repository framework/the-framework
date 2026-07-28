OpenAI provider suite split one file per capability and assembled by `provider.ts`; its chat adapter doubles as the engine for every OpenAI-compatible provider in the parent directory.

## TLDR

- `provider.ts` — `OpenAIProvider` factory (name `'openai'`), the fullest capability surface in the SDK.
- `chat.ts` — Chat Completions adapter (+`normalizeToolTranscript` protocol repair, native `file_search` block, streamed-usage handling); reused by Ollama/Groq/DeepSeek/xAI/Azure/Mistral/OpenRouter via `OpenAIConfig`.
- `prompt-cache.ts` — `prompt_cache_key` builder (cyrb53 over marked regions).
- `embeddings.ts` — raw-`fetch` embeddings (no SDK client).
- `images.ts` / `tts.ts` / `stt.ts` — DALL-E, speech synthesis, Whisper transcription via the SDK.
- `files.ts` — Files API CRUD; `vector-store.ts` — hosted vector stores with ingestion polling (#B8).
- `client.ts` / `config.ts` — lazy `openai` SDK construction / `OpenAIConfig` type (`defaultHeaders` for derivatives).
- `index.ts` — public barrel (re-exported by the legacy `../openai.ts` path).
