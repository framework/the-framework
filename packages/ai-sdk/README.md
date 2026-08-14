# @gemstack/ai-sdk

AI engine: providers, agents, tools, streaming, middleware, structured output, evals, computer-use, and testing fakes.

The first [GemStack](https://github.com/gemstack-land/the-framework) package. Spun out of Rudder's `@rudderjs/ai` (carried forward from the 1.17.x line, renamed and re-versioned under the GemStack umbrella). The Rudder package, `@rudderjs/ai`, now re-exports this engine and adds the Rudder-specific bindings on top (the `AiProvider`, ORM-backed stores, doctor check, and `make:agent` / `ai:eval` CLI) — it is the Rudder binding over this engine, not a dying shim.

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

- `BudgetStorage` ships an in-memory default; bring your own backend by implementing the interface.
- `CacheAdapter` (the suspendable run stores) and `StorageAdapter` (`ImageGenerator`/`AudioGenerator` `.store()`) are caller-supplied — no storage/cache package is bundled.

The engine is now fully framework-agnostic: it has **no `@rudderjs/*` peer dependency**. The ORM-backed implementation of that contract (Prisma/Drizzle/native), the `/server` provider, and the `make:agent` scaffolder and `ai:eval` CLI command are all Rudder bindings and live in [`@rudderjs/ai`](https://www.npmjs.com/package/@rudderjs/ai) (`@rudderjs/ai/budget-orm`, plus the provider and CLI), not here. Rudder users pick them up there unchanged. The version line stays `0.x` while the API settles toward `1.0.0`.

## Subpath exports

| Subpath | What it provides |
|---|---|
| `.` | Core: `Agent`, `tool`, streaming, middleware, facade |
| `./node` | Node-only entry |
| `./computer-use` | Computer-use tool + executor |
| `./eval` | Eval framework (`evalSuite`, metrics, reporters) |
| `./gateway` | Gateway helpers |
| `./react` | React bindings |

>
> **Moved to `@rudderjs/ai`:** the ORM-backed store (`./budget-orm`) coupled the engine to `@rudderjs/orm`, so it now lives in [`@rudderjs/ai`](https://www.npmjs.com/package/@rudderjs/ai) under the same subpath name. Update `@gemstack/ai-sdk/budget-orm` imports to `@rudderjs/ai/budget-orm`. It implements the same `BudgetStorage` contract, still exported from here.
>
> **Moved to `@rudderjs/ai`:** the `/server` provider (which carried a `@rudderjs/core` peer) and the `make:agent` scaffolder + `ai:eval` CLI command (which carried a `@rudderjs/console` peer) are Rudder bindings, so they now live in [`@rudderjs/ai`](https://www.npmjs.com/package/@rudderjs/ai). The engine no longer ships the `./server` / `./commands/*` subpaths or any `@rudderjs/*` peer.

## License

MIT
