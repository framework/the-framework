The agent runtime's engine room: define an agent once — model, instructions, tools, guardrails — and this code runs it against any of a dozen interchangeable AI providers, with streaming, memory, retrieval, sub-agents, and human-in-the-loop pauses built in.

## TLDR

- An agent runs as a loop: ask the model, execute the tools it called, feed the results back, repeat until a stop condition or the step budget ends it; middleware can observe or adjust every step, and failures fail over to declared alternate models.
- Providers are interchangeable behind one registry keyed by plain "provider/model" names, one contract per capability — chat, embeddings, reranking, image generation, speech both ways, files, hosted vector stores — with adapters for each vendor and a template for wiring OpenAI-ish gateways.
- Tools are typed definitions that run on the server (optionally streaming progress) or in the browser; capability families collapse into one flat tool so small models see one call; whole agents mount as tools inside other agents or take over via handoff.
- Humans stay in the loop: a run pauses for browser-side tools or for approval of a risky call, its state persists in a run store, and it resumes later — singly or in batches — with loaded histories repaired so any provider accepts the replay.
- Persistence and infrastructure are bring-your-own contracts (conversations, user memory, paused runs, cache, blob storage, job queue) with in-memory defaults, and a full fake provider stands in for every capability so applications test without spending a token.
- Around the core sit per-user memory extraction and injection, retrieval (hosted file search, database similarity search, reranking, cached embeddings), media generation and transcription, spend budgets, eval suites, computer use, and React bindings; output streams over the package's own protocol or the Vercel AI one.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
