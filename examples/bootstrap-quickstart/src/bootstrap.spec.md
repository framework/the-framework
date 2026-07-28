The offline "capstone" example: the whole ai-autopilot epic in one deterministic flow — framework preset detection → Bootstrap (scope → build → full-fledged loop → deploy) → scale mode — via `AiFake` + `FakeRunner`.

## TLDR

- Detects Vike from `PROJECT_DEPS` via `builtinFrameworkPresetRegistry().select()`, so build workers are briefed on the right framework.
- `Bootstrap` steps: static `scope` (full + `INTENT`), `supervisorBuild` (static `Planner` + 3 workers holding `runnerTools(session)`, concurrency 1), `loopChecklist`/`loopImprove` over a `LoopEngine`, and `agentDeploy` through the real `cloudflareTarget` adapter.
- The scripted loop blocks pass 1 on "No authentication on the orders page yet", clears on pass 2 → `productionGrade: true` in 2 passes.
- `FakeRunner`'s `onExec` simulates `wrangler` by printing `DEPLOY_URL`, so `cloudflareTarget` runs its full install → build → deploy → parse-URL path offline.
- Events stream through `launchAutopilot`; `formatBootstrapEvent()` renders one narration line per `BootstrapEvent` (exported and reused by `live.ts`).
- Scale mode: `CodeOverviewMaintainer.handle({ kind: 'major-change' })` regenerates a `CODE-OVERVIEW.md`-shaped `CodeOverview` from the scaffold.
- Exports `INTENT`, `CapstoneResult`, `formatBootstrapEvent`, `runCapstone(write?)`.

## Decisions

- `AiFake` scripts only the build workers (write-file tool-call + text pairs) and the final deploy-decision JSON; the loop runs scripted local prompts, not the model — so the fake sequence stays short and order-deterministic.
- The deploy uses the real `cloudflareTarget` adapter (not a stub) with a fake token (`CLOUDFLARE_API_TOKEN` env or `'demo-token'`), exercising the real deploy code path offline.
- What stack to build on is the build agent's call, not the harness's (per the header comment).
- `live.ts` is the live proof for #124: the same flow with a real model + `LocalRunner`.

## Facts

- `DEPLOY_DECISION = { render: 'ssr', target: 'cloudflare' }`; `DEPLOY_URL = https://orders-app.gemstack.workers.dev`.
- The sandbox is seeded with only `package.json` (`{ name: 'orders-app' }`); workers add `database/schema.ts`, `pages/orders/+Page.jsx`, `pages/orders/+config.js`.

## Flows

- `runCapstone: AiFake.fake() + scriptModel() → presetRegistry.select(PROJECT_DEPS) → FakeRunner.boot() → launchAutopilot(new Bootstrap({steps}).run()) → handle.result() → session.snapshot() → CodeOverviewMaintainer.handle(major-change) → CapstoneResult{detection, result, events, files, overview}; finally fake.restore()`
