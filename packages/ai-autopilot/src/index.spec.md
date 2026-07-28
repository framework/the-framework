Package entry: the public API barrel of `@gemstack/ai-autopilot`, re-exporting every subsystem, with a long doc comment that doubles as the package's architecture map.

## TLDR

- Re-exports, grouped: Supervisor core (`Supervisor`, `agentPlanner`, `agentSynthesizer`/`defaultSynthesize`, core types), the runner seam (`runner/index.js`), surfaces (`surface/index.js`), decisions ledger (`decisions/`), the loop engine (`loop/`), the prompts library (`prompts/`), bootstrap mode (`bootstrap/`, including deploy targets), overview/scale mode (`overview/`), framework detection (`framework-detection/`), and domain presets (`preset/`).
- The doc comment states the layering bet: autopilot owns the *control policy* over many agent runs; ai-sdk owns the single-agent loop and handoff/subagent primitives.

## Facts

- `runPool` is deliberately NOT exported — it is `@internal` to the Supervisor.
- Everything else in the subsystems' `index.ts` barrels flows through here; this file defines the published API surface (`main: dist/index.js`).
