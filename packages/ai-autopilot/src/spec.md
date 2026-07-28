Source of `@gemstack/ai-autopilot` — the "director" layer over `@gemstack/ai-sdk` agents: a Supervisor topology, a pluggable runner seam, event surfaces, and the autonomy subsystems (decisions, loop, prompts, presets, bootstrap, overview, framework detection).

## TLDR

- Supervisor core (top level): `supervisor.ts` (plan → dispatch → synthesize), `planner.ts`/`synthesizer.ts` (LLM stage builders over `Output.array` / prompt composition), `pool.ts` (internal bounded-concurrency pool with stop predicate), `types.ts` (stage contracts + `SupervisorEvent`), each with a sibling `*.test.ts`.
- `runner/` — the pluggable execution seam: one Flue-shaped `Runner` interface, adapters fake/local/docker/webcontainer, shared path guard, and `runnerTools` bridging a session to an agent as tools.
- `surface/` — terminal / in-page / background surfaces over `onEvent`: `EventStream` (replayable transport), `formatEvent`/`terminalSink`, `launchAutopilot` (detached handle).
- `decisions/` — durable memory: `DecisionLedger` round-tripping a human-editable `DECISIONS.md`, lexical `consult` matching, `decisionTools`/`decisionBriefing` for agents.
- `loop/` — event → prompt-chain policy: `LoopEngine` matches a declared `LoopEvent` kind to a chain of prompts (N fresh-context passes each), `defaultLoops` web-app policy, `{ blockers }` verdict parsing.
- `prompts/` — the prompt-bodies library: parse/load markdown bodies (shipped under `../prompts/`), `loopPromptsFor` materializes them into loop prompts.
- `preset/` — domain presets (`{ loops, prompts }` bundles) loaded from `../presets/*` markdown dirs, composable (presets-of-presets), with mode-variant condition files.
- `bootstrap/` — the spine from nothing to a production-grade app: scope → build (Supervisor) → full-fledged loop → deploy (serve-check, cloudflare/dokploy targets behind a `DeployTarget` seam).
- `overview/` — scale mode: a `CODE-OVERVIEW.md` maintainer refreshed only on *material* change (#114).
- `framework-detection/` — score a project's deps/files against framework presets (Vike flagship, Next.js second).
- `util/` — `makeEmitter` observer isolation. `index.ts` — the public barrel; its doc comment is the package map.

## Decisions

- Layering rule (from the README, enforced by scope): if a feature is just calling an ai-sdk primitive it belongs in ai-sdk — autopilot earns its keep only as the topology / control-policy layer.
- Prompt bodies and presets ship as *data* (markdown under the package root), so contributors improve behavior by editing prose, not code.

## Facts

- Engines share conventions: optional `onEvent` wrapped by `util/emitter.ts` so observers can't abort runs; error messages prefixed `[ai-autopilot]`.
- Tests are `node:test` suites compiled first (`tsc -p tsconfig.test.json`) and run from `dist-test/`.
