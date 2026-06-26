# @gemstack/ai-sdk

AI engine: providers, agents, tools, streaming, middleware, structured output, conversation memory, evals, computer-use, and testing fakes.

The first [GemStack](https://github.com/gemstack-land/gemstack) package. Spun out of Rudder's `@rudderjs/ai` (carried forward from the 1.17.x line, renamed and re-versioned under the GemStack umbrella). The Rudder package now ships as a thin deprecated re-export of this one.

## Installation

```bash
pnpm add @gemstack/ai-sdk
```

Install the provider SDK(s) you need:

```bash
pnpm add @anthropic-ai/sdk             # Anthropic (Claude)
pnpm add openai                         # OpenAI (GPT), also used for OpenRouter / Mistral / DeepSeek / Groq / xAI / Ollama
pnpm add @google/genai                  # Google (Gemini)
pnpm add cohere-ai                      # Cohere (reranking + embeddings)
pnpm add @aws-sdk/client-bedrock-runtime # AWS Bedrock
# ElevenLabs (premium TTS + STT)        - no extra package needed (direct HTTP)
# VoyageAI (embeddings + reranking)     - no extra package needed (direct HTTP)
# Jina                                   - no extra package needed (direct HTTP)
```

## Status

The core stands alone: `@gemstack/ai-sdk`'s only required runtime dependency is `zod`. Persistence is via **neutral contracts** you implement against your own infrastructure:

- `ConversationStore`, `UserMemory`, `BudgetStorage` ship in-memory defaults; bring your own backend by implementing the interface.
- `CacheAdapter` (the suspendable run stores) and `StorageAdapter` (`ImageGenerator`/`AudioGenerator` `.store()`) are caller-supplied — no storage/cache package is bundled.

The ORM-backed implementations of those contracts (Prisma/Drizzle/native via `@rudderjs/orm`) are a Rudder binding and live in [`@rudderjs/ai`](https://www.npmjs.com/package/@rudderjs/ai) (`@rudderjs/ai/conversation-orm`, `/memory-orm`, `/budget-orm`, `/memory-embedding`), not here. A few remaining opt-in subpaths still carry optional Rudder peers (`/server` → `@rudderjs/core`; doctor + `make:agent` → `@rudderjs/console`). The version line stays `0.x` while the API settles toward `1.0.0`.

## Subpath exports

| Subpath | What it provides |
|---|---|
| `.` | Core: `Agent`, `tool`, streaming, middleware, facade |
| `./server` | The server provider entry |
| `./node` | Node-only entry |
| `./computer-use` | Computer-use tool + executor |
| `./eval` | Eval framework (`evalSuite`, metrics, reporters) |
| `./gateway` | Gateway helpers |
| `./react` | React bindings |

> **Moved in `0.3.0`:** the MCP bridge (`mcpClientTools` / `mcpServerFromAgent`), previously the `./mcp` subpath, is now its own package, [`@gemstack/ai-mcp`](https://github.com/gemstack-land/gemstack/tree/main/packages/ai-mcp). Update `@gemstack/ai-sdk/mcp` imports to `@gemstack/ai-mcp` and move the `@modelcontextprotocol/sdk` peer there.
>
> **Moved to `@rudderjs/ai`:** the ORM-backed stores (`./conversation-orm`, `./memory-orm`, `./budget-orm`, `./memory-embedding`) coupled the engine to `@rudderjs/orm`, so they now live in [`@rudderjs/ai`](https://www.npmjs.com/package/@rudderjs/ai) under the same subpath names. Update `@gemstack/ai-sdk/conversation-orm` imports to `@rudderjs/ai/conversation-orm` (etc.). They implement the same `ConversationStore` / `UserMemory` / `BudgetStorage` contracts, still exported from here.

## License

MIT
