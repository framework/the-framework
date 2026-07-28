Tests for `server-from-agent.ts` `'agent'` and `'both'` exposure modes — covers running the whole agent as a single MCP prompt-tool.

## TLDR

- A scripted `ProviderAdapter` (pattern copied from `handoff.test.ts`) is registered in `AiRegistry` as model `fake/m`, so `agent.prompt()` runs without a real LLM; `AiRegistry.reset()` in `beforeEach`.
- Agent mode: exactly one tool named after the agent class, `agentToolName` override, a missing `prompt` surfaces as either an MCP throw or an error result (both accepted — the assertion matches `Invalid arguments|prompt|required`), and a `tools()`-less agent works.
- Both mode: `listTools` shows the individual tool and the prompt-tool side by side, and both are callable in one session.
