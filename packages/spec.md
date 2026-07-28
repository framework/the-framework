All GemStack npm packages: The Framework product and dashboard, the AI engine family, the MCP family, and the marketing website.

## TLDR

- `the-framework/` — the product: CLI + daemon + run lifecycle (git worktrees per run, event/control JSONL files, queue, presets, tickets, quota guards, Discord bridge, cloud/CI runs), driving coding-agent CLIs as black boxes.
- `framework-dashboard/` — the localhost dashboard UI (React + Vike + Tailwind, Telefunc RPC), a pure projection of the `.the-framework/` files the daemon writes; prerendered and bundled into the product.
- `ai-sdk/` — the agent runtime: multi-provider LLM SDK (Anthropic, OpenAI, Google, Bedrock, and many more), agent loop, tools, streaming, structured output, memory, eval, budget, computer use.
- `ai-autopilot/` — autonomy and orchestration engine: bootstrap spine (scaffold→deploy), autonomous dev loop with verdict/policy, planner/supervisor/synthesizer multi-agent pool, sandboxed runners (local, Docker, WebContainer), presets.
- `ai-skills/` — portable capability bundles (`SKILL.md` frontmatter manifest + optional `tools.ts`): registry, loader, composition onto agents with progressive disclosure.
- `ai-mcp/` — the agent ⇄ MCP bridge: consume a remote MCP server's tools as agent tools, or expose an agent as an MCP server.
- `mcp/` — agent-agnostic MCP server-authoring framework: `McpServer`/`McpTool`/`McpResource`/`McpPrompt`, decorators, OAuth2, Node/Web handlers, testing helpers.
- `mcp-connectors/` — the connector contract (`defineConnector`) + `mountConnectors` orchestrator composing connectors into one `mcp` server.
- `mcp-connector-github/`, `mcp-connector-google-drive/` — first-party connectors built on that contract.
- `the-framework.ai/` — the Vike-prerendered marketing site for https://the-framework.ai.

## Facts

- Naming rule: `ai-*` = depends on the agent runtime (`ai-sdk`); agent-agnostic packages (`mcp`, `mcp-connectors`, connectors) are peers without the prefix.
- One-directional dependencies: `ai-skills`/`ai-autopilot`/`ai-mcp` → `ai-sdk`; `mcp-connector-*` → `mcp-connectors` → `mcp`. Nothing depends "up", and the product layer (`the-framework`) sits on top of the engines.
- Two MCP axes that must not be conflated: `ai-mcp` bridges an existing Agent to MCP; `mcp` is for authoring servers from scratch (see `Architecture.md`).
- `framework-dashboard` is not served standalone in production: the product bundles its prerendered output (`bundle:dashboard` task) and the daemon serves it.
