The agent runtime: define an agent once — model, instructions, tools, guardrails — and run it against any of a dozen AI providers, with streaming, memory, sub-agents, and human-in-the-loop pauses built in.

## TLDR

- An agent runs as a loop — ask the model, execute the tools it called, feed the results back, repeat — until a stop condition fires or the step budget runs out, with middleware and hooks observing or adjusting every step.
- Providers are interchangeable behind one contract per capability — chat, embeddings, reranking, image generation, speech in and out, file storage, vector stores — resolved by plain `provider/model` names.
- Humans stay in the loop where it matters: a tool can pause the run to be resolved in the browser, a risky call can pause for approval, and both resume the same logical run.
- Any agent can be handed control outright, or mounted as a tool inside another agent — including suspendable sub-agents resumed later, alone or in batches.
- The package trusts nothing external by default: persistence is a set of neutral contracts with in-memory defaults, and a full fake provider stands in for every capability.

## Flows

- **Talking to a model.** Messages carry text, images, and documents; audio is its own surface (speech-to-text in, text-to-speech out), as is image generation — each with failover and optional storage of what was produced. Responses stream over the package's own wire protocol or over the Vercel AI SDK's, for UIs already speaking it. If the model fails, the loop fails over to the declared alternates and remembers that it did. Declaring an agent cacheable turns into each provider's native prompt caching. Provider-hosted tools — web search, web fetch, code execution — are used natively where the provider has them and emulated where it doesn't.
- **Tools.** Tools declare typed inputs that are validated before the handler runs. A family of capabilities can be collapsed into one flat tool. Structured output is a helper the caller composes: instructions in, validated parse out.
- **Remembering.** An agent opted into memory extracts durable facts from each turn and injects the relevant ones into the next, per user. A conversational agent loads its history before every prompt and appends after, so callers just keep prompting.
- **Finding things.** Retrieval is either the provider's own hosted file search (with a local fallback to configure for providers that have none) or a direct similarity search over the application's own data — embed the query, return the top matches, optionally reranked; embeddings are cached.
- **Spending.** A budget is enforced per period as middleware around every step: an estimate is debited before the model call and trued up after, against a maintained price catalog. Queue-backed jobs stream their progress through neutral queue contracts; durability belongs to the host application.
- **Proving it works.** Eval suites run cases with assertions — exact and fuzzy matching, shape checks, an LLM judge, token-cost bounds — with recorded fixtures for replay and reports for humans and machines.
- **Reaching the real world.** Computer use gives an agent a real browser to drive (the provider's native computer-use capability; one provider supports it today). React bindings drive a run from a component, surfacing pending client tools and approvals while the run stays logically "running" — the state machine underneath is framework-free.

## Rationales

- Both ends of the streaming wire protocol ship in the package — server and browser — so the vocabulary can't drift.
- Collapsing a tool family into one flat tool exists so small models see one call instead of many.
- Structured output throws on mismatch and nothing retries automatically — retrying is the caller's decision to make.
- The budget debits an estimate before the call and trues up after, because the real cost is only known once the response exists.
- Evals run against the very same agent instances the application uses — testing a copy would prove nothing.
- In-memory persistence defaults and the full fake provider exist so applications test without spending a token.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
