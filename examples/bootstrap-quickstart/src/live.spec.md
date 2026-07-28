The LIVE half of the capstone (#124): the same Bootstrap flow as `bootstrap.ts`, with the fakes swapped for a real Anthropic model (via `@gemstack/ai-sdk`) and a real `LocalRunner` writing files into a temp workspace on disk.

## TLDR

- `registerModel()` requires `ANTHROPIC_API_KEY` and registers `AnthropicProvider`, failing loudly at startup rather than at request time; model defaults to `anthropic/claude-haiku-4-5-20251001`, overridable via `GEMSTACK_MODEL`.
- Only the decomposition is fixed (`livePlanner` = 3 subtasks by worker name); real model-driven workers with `runnerTools(session)` decide the actual file contents and write real files.
- The production-grade loop keeps the same scripted verdicts as the offline example (blocks once on "no auth", then clears) — deterministic, and spends no model budget on the checklist; a real reviewer agent is called out as the natural follow-up.
- `deployStep()`: with `CLOUDFLARE_API_TOKEN` set, a real `cloudflareTarget` deploy (project from `CLOUDFLARE_PROJECT`, default `gemstack-orders-demo`); without it, plan-only `agentDeploy` (decide + narrate, no ship), so a model key alone suffices.
- Returns the same `CapstoneResult` shape as `bootstrap.ts` (reuses `INTENT`, `formatBootstrapEvent`); `snapshot()` reads the workspace through `session.fs.list()/read()`.

## Facts

- Env vars: `ANTHROPIC_API_KEY` (required), `GEMSTACK_MODEL`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_PROJECT`.
- The temp workspace is disposed in `finally` (`session.dispose()`), so live runs leave no files behind.

## Flows

- `runLiveCapstone: registerModel() → presetRegistry.select(deps) → LocalRunner.boot() → launchAutopilot(Bootstrap.run()) with narration via formatBootstrapEvent → handle.result() → snapshot(session) → CodeOverviewMaintainer.handle(major-change) → CapstoneResult; finally session.dispose()`
