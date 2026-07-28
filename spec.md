Monorepo of GemStack — framework-agnostic AI engines published as `@gemstack/*` npm packages — and its flagship product "The Framework", an autonomous-AI-programming tool (a local daemon + dashboard that drives coding agents such as Claude Code and Codex unattended).

## TLDR

- `packages/` — every publishable package: the product (`the-framework`, `framework-dashboard`), the AI family (`ai-sdk`, `ai-skills`, `ai-autopilot`, `ai-mcp`), the MCP family (`mcp`, `mcp-connectors`, `mcp-connector-github`, `mcp-connector-google-drive`), and the marketing site (`the-framework.ai`).
- `examples/` — runnable quickstarts for the engine packages (autopilot, bootstrap, connectors, mcp, framework demo).
- `spike/` — exploratory spike code (Chrome extension bridging claude.ai web sessions).
- `experiments/` — throwaway product experiments (specs/patches only, no shipped source).
- `tickets/` — markdown ticket backlog, managed by The Framework itself (dogfooding).
- `.the-framework/` — run state The Framework wrote while being dogfooded on this repo (committed session logs, conversations, `LOGS.md`).
- `.github/workflows/` — CI, release, website deploy, prompt-drift check, and the workflow that runs The Framework's agent inside GitHub Actions.
- Root docs: `Architecture.md` (package layering and naming rationale), `BUSINESS_LOGIC.md` (catalogue of every high-level flow, the breadth pass), `FEATURES.md` (per-feature inventory with deterministic fake-agent test recipes), `TODO_AGENTS.md` (agent task notes).
- Tooling: pnpm workspaces (`packages/*`, `examples/*`), Turbo tasks (`build`, `test`, `typecheck`, `bundle:dashboard`), changesets for versioning/publishing.

## Facts

- The `ai-` package-name prefix means "depends on the agent runtime"; agent-agnostic packages (`mcp`, `mcp-connectors`) deliberately do not get it (`Architecture.md`).
- Dependency direction is one-way: `ai-skills`, `ai-autopilot`, `ai-mcp` depend on `ai-sdk`; `ai-sdk` depends on none of them. Connectors depend on `mcp`, not on `ai-sdk`.
- Four layers (per `BUSINESS_LOGIC.md`): product (`the-framework`) → dashboard (`framework-dashboard`, a pure projection of daemon-written files) → orchestration engines (`ai-autopilot`, `ai-sdk`, `ai-skills`, `ai-mcp`) → MCP server framework (`mcp` + connectors).
- The product's core invariant: **files are the seam** — a run appends to `.the-framework/events.jsonl`, the daemon tails it and pushes to browsers; steering flows back through `.the-framework/control.jsonl`. There is no run↔daemon IPC.
- This repo is developed with The Framework itself; committed session logs under `.the-framework/` and `tickets/` are part of that dogfooding loop, not build inputs.
- `packages/the-framework/src/prompts.generated.ts` is generated from `packages/the-framework/prompts/**/*.md` and gitignored; CI has a prompt-drift check for it.
