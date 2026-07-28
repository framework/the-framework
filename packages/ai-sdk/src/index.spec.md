Barrel entrypoint of `@gemstack/ai-sdk` — re-exports the whole public runtime-agnostic surface.

## TLDR

- Types (`./types.js`), `AiRegistry`, and 16 provider classes (Anthropic, OpenAI, Google + `GoogleCacheRegistry`, Ollama, DeepSeek, xAI, Groq, Mistral, Azure, Cohere, Jina, ElevenLabs, Voyage, OpenRouter, Bedrock).
- Tools: `toolDefinition`/`dynamicTool`/`ToolBuilder`, pause control chunks, `zodToJsonSchema`, `scopedTool`, handoffs, `fileSearch`, `similaritySearch`.
- Agent: `Agent`/`ConversableAgent`/`agent`, stop combinators, `setConversationStore`/`setUserMemory`, `QueuedPromptBuilder`/`configureAiQueue`.
- Middleware runners, `Output`, conversation (`MemoryConversationStore`, `sanitizeConversation`, continuation validation), user memory (#A4: `MemoryUserMemory`, `withMemoryInject`, `withMemoryExtract`).
- Bring-your-own contracts: `CacheAdapter`, `StorageAdapter`, `QueueDispatch`/`QueueBroadcast`; run stores (sub-agent + standalone agent).
- Facades: `AI`, `ImageGenerator`, `AudioGenerator`, `Transcription`, `Reranker`, `FileManager`, `VectorStores` (#B8), provider tools (`WebSearch`/`WebFetch`/`CodeExecution`), Vercel data-stream + agent-SSE converters, budget/pricing (#A6), `AiFake` for tests.

## Facts

- Separate subpath exports exist for `/node`, `/observers`, `/gateway`, `/eval`, `/computer-use`, `/react`, `/chat-mentions` (see package.json) — this file is only the main entry and must stay free of Node-only imports (enforced by `isomorphic-check.test.ts`).
