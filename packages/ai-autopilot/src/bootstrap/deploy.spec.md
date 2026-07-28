The deploy *decision* step: an ai-sdk agent decides `{ render, target, reason }` and hands the plan to a `DeployTarget` — deciding is this module's job, executing is the target's.

## TLDR

- `agentDeploy(deployer, opts)` builds `BootstrapSteps['deploy']`: prompts the agent with intent + scope + productionGrade + allowed targets, parses a structured `{ render, target, reason }` via `Output.object` (zod schema), then calls `target.deploy(plan)`.
- `planOnlyTarget()` — the v1 default target: reports `{ deployed: false }` with an "infra-gated" detail, so bootstrap decides + narrates without a blind deploy.
- `FakeDeployTarget` — test double that records every plan handed to it and returns a canned result.
- `DEFAULT_DEPLOY_TARGETS = ['dokploy', 'cloudflare']` steers the decision when no `targets` list is given.

## Decisions

- v1 ships plan-only by default; real Dokploy/Cloudflare adapters implement the same `DeployTarget` seam (same pattern as the runner seam) as infra-gated follow-ups.
- Model output is normalized against the allowed sets so a stray value cannot slip through: unknown `render` → `'ssr'`, unknown `target` → first allowed target.
- The default instructions tell the agent to *decide, not ask*: SSR for per-request data/auth, SSG for mostly-static content, SPA only for client-side dashboards behind a login.

## Flows

- deploy step: build context text → `deployer.prompt(instructions + context + output.toSystemPrompt())` → `output.parse(response.text)` → normalize render/target → `target.deploy({ plan, intent, signal })` → `{ plan, result }`.
