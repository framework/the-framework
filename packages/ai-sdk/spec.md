`@gemstack/ai-sdk` — standalone multi-provider AI engine: providers, agents, tools, streaming, middleware, structured output, conversation memory, evals, budget caps, computer-use, and testing fakes.

## TLDR

- `src/` — all engine source (see `src/.spec.md` for the theme map: agent core, tools, conversation/persistence, memory, SSE protocols, modalities, RAG, budget, eval, computer-use, gateway, providers, node/react/util splits).
- `boost/` — shipped agent-facing docs (published via `files`): `guidelines.md` (usage guide for the package) and `skills/ai-agents/SKILL.md` + `skills/ai-tools/SKILL.md`.
- `package.json` — subpath exports: `.` (core), `./node`, `./observers`, `./chat-mentions`, `./gateway`, `./eval`, `./computer-use`, `./react`.
- `README.md`/`CHANGELOG.md` — status, install matrix, migration notes; `tsconfig.json`/`tsconfig.build.json`/`tsconfig.test.json` — typecheck/build/test splits (tests compile to `dist-test/` and run under `node --test`).

## Facts

- Dependency posture: only required runtime dep is `zod`; every vendor SDK (`@anthropic-ai/sdk`, `openai`, `@google/genai`, `cohere-ai`, `@aws-sdk/client-bedrock-runtime`) is an optionalDependency — install what you use; ElevenLabs/Voyage/Jina go over direct HTTP. `react >= 19.2.0` is an optional peer (only `./react` needs it).
- Lineage: "the first GemStack package", spun out of Rudder's `@rudderjs/ai` (1.17.x line). `@rudderjs/ai` now re-exports this engine and layers the Rudder bindings on top: ORM-backed `ConversationStore`/`UserMemory`/`BudgetStorage`/memory-embedding, the `/server` provider, and the `make:agent` + `ai:eval` CLI. The engine has NO `@rudderjs/*` peer.
- Moves to know when chasing old imports: the MCP bridge left for `@gemstack/ai-mcp` in 0.3.0 (was `./mcp`); `./conversation-orm`, `./memory-orm`, `./budget-orm`, `./memory-embedding`, `./server`, `./commands/*` all moved to `@rudderjs/ai` under the same names.
- Version line stays 0.x (currently 0.6.x) while the API settles toward 1.0.0; requires Node >= 22.12; ESM only (`"type": "module"`).
