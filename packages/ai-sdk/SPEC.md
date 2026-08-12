The agent runtime: define an agent once — model, instructions, tools, guardrails — and run it against any of a dozen AI providers, with streaming, memory, sub-agents, and human-in-the-loop pauses built in.

## TLDR

- An agent runs as a loop: ask the model, execute the tools it called, feed the results back, repeat — until a stop condition fires or the step budget runs out. Middleware and hooks can observe or adjust every step, and if the model fails, the loop fails over to the declared alternates and remembers that it did.
- Providers are interchangeable behind one contract per capability — chat, embeddings, reranking, image generation, speech in and out, file storage, vector stores — resolved by plain `provider/model` names. A template exists for wiring any gateway that speaks an OpenAI-ish dialect.
- Humans stay in the loop where it matters: a tool can pause the run to be resolved in the browser, a risky call can pause for approval, and both resume the same logical run. Any agent can also be handed control outright, or mounted as a tool inside another agent — including suspendable sub-agents resumed later, alone or in batches.
- The package trusts nothing external by default: persistence (conversations, memory, runs) is a set of neutral contracts with in-memory defaults, and a full fake provider stands in for every capability so applications test without spending a token.

## Flows

**Talking to a model.** Messages carry text, images, and documents; audio is its own surface (speech-to-text in, text-to-speech out), as is image generation — each with failover and optional storage of what was produced. Responses stream over the package's own wire protocol (with both the server and browser ends shipped, so the vocabulary can't drift) or over the Vercel AI SDK's, for UIs already speaking it. Declaring an agent cacheable turns into each provider's native prompt caching. Provider-hosted tools — web search, web fetch, code execution — are used natively where the provider has them and emulated where it doesn't.

**Tools.** Tools declare typed inputs that are validated before the handler runs. A family of capabilities can be collapsed into one flat tool so small models see one call instead of many. Structured output is a helper the caller composes (instructions in, validated parse out — it throws on mismatch; nothing retries automatically).

**Remembering.** An agent opted into memory extracts durable facts from each turn and injects the relevant ones into the next, per user. A conversational agent loads its history before every prompt and appends after, so callers just keep prompting.

**Finding things.** Retrieval is either the provider's own hosted file search (with a local fallback to configure for providers that have none) or a direct similarity search over the application's own data — embed the query, return the top matches, optionally reranked; embeddings are cached.

**Spending.** A budget is enforced per period as middleware around every step: an estimate is debited before the model call and trued up after, against a maintained price catalog. Queue-backed jobs stream their progress through neutral queue contracts; durability belongs to the host application.

**Proving it works.** Eval suites run cases with assertions — exact and fuzzy matching, shape checks, an LLM judge, token-cost bounds — against the very same agent instances the application uses, with recorded fixtures for replay and reports for humans and machines.

**Reaching the real world.** Computer use gives an agent a real browser to drive (the provider's native computer-use capability; one provider supports it today). React bindings drive a run from a component, surfacing pending client tools and approvals while the run stays logically "running" — the state machine underneath is framework-free.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
