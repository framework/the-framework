`@gemstack/ai-sdk` — the framework-agnostic agent engine: providers, the agent loop, tools, streaming, middleware, structured output, conversation/memory, retrieval, budget, eval, computer use, React bindings, and an offline fake.

## TLDR

- **Agents are classes declared via overridable methods** (only `instructions()` is abstract; model, failover, max steps, stop conditions, temperature, caching, conversation and memory specs all have defaults; `tools()`/`middleware()` are duck-typed opt-ins). `agent(...)` builds one inline.
- `prompt()`/`stream()` run the same loop — prepare the step, call the provider (with failover), execute tool calls, feed results back, repeat until a stop condition or the step cap. Streaming and non-streaming share one implementation (the non-streaming path drains the same generators), which is the parity guarantee for tool behavior.
- **Pause/resume is first-class**: a run can park on client tools (resolved in the browser) or a human approval gate, snapshot itself into a run store, and resume — including up through nested sub-agents. Two nesting models are deliberately distinct: `asTool` (call-and-return sub-agent) and `handoff` (control transfer; the parent's loop ends).
- Providers resolve from `'<provider>/<model>'` strings through a registry: full adapters (Anthropic, OpenAI, Google, Cohere, Bedrock), a factory for OpenAI-compatible hosts (xAI, Groq, DeepSeek, Ollama, Azure…), specialists (Voyage/Jina/ElevenLabs), and a gateway template for anything else.
- One hard runtime dependency (`zod`); all provider SDKs are optional dependencies loaded lazily on first use. Entry points: `.` plus `./node`, `./observers`, `./chat-mentions`, `./gateway`, `./eval`, `./computer-use`, `./react`.
- Map: `src/spec.md` (area map and core files), `src/providers/spec.md`, `src/eval/spec.md`, `src/computer-use/spec.md`, `src/react/spec.md`, `src/budget/spec.md`, `src/gateway/spec.md`.

## Decisions

- **The main entry is runtime-agnostic, enforced by a test** that scans the compiled output for static `node:`/`fs`/`path` imports outside `dist/node/` — hence a pure-JS hash, web-global base64, and the `./node` subpath holding the only path-based helpers.
- **The double-load problem is a recurring design driver**: a bundler can inline the SDK while a second copy loads from `node_modules`, so every cross-boundary identity is `Symbol.for(...)` and every process-wide registry lives on `globalThis`. The legacy `rudderjs` names in those symbols and globals are **load-bearing** (renaming is a cross-bundle break); user-facing strings say `[ai-sdk]`.
- Everything persistent is a caller-supplied contract (conversation store, user memory, budget storage, cache/storage/queue adapters) with in-memory reference implementations — no storage backend is bundled.
- Security posture: run ids are unguessable capability handles; resume snapshots are consumed atomically (a replayed id cannot read twice); conversation ownership is enforced with an error that never names the real owner; continuation requests are validated against rewritten history, forged tool results, and forged approvals; computer use requires approval by default.
- `fake.ts` exists because there is no HTTP-mocking dependency and SDKs load dynamically — the provider-factory seam is the only dependency-free interception point. It covers every adapter kind, scripts multi-step sequences, and has a strict mode because the ambient default response silently made tests pass on prompts they never meant to send.
- `boost/` ships in the package: agent-facing guidelines plus two `SKILL.md` bundles — the convention `@gemstack/ai-skills` was later built around. (Its content still says `@rudderjs/ai` throughout — known drift.)

## Facts

- The package graduated from Rudder's `@rudderjs/ai`, which now re-exports it and keeps the Rudder-only bindings; the `./mcp` subpath was hard-moved to `@gemstack/ai-mcp`.
- Three tool-transcript repair layers exist and must not be conflated: store-level sanitization (strips dangling turns before replay), wire-level normalization for OpenAI-compatible hosts (synthesizes stub results to keep an in-flight request valid), and approval-resume reconstruction (real-or-placeholder results based on current approval state).
- Known gaps, deliberately documented: structured output does **not** retry on parse mismatch (parsing throws; retry is the caller's); token usage carries no cache-token fields, so cached input is billed at full rate by the budget middleware; budgets issue no refunds on error; parallel tool executions share one middleware context.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
