All types for bootstrap mode (#116): the scope/build/loop/deploy step contracts, the narration event union, and the run result.

## TLDR

- `BootstrapSteps` — the injectable steps: `scope` + `build` required; `checklist`/`improve` drive the full-fledged loop (full scope only); `deploy` is the optional final phase. Each step gets a context type (`BuildContext`, `LoopPassContext`, `DeployContext`).
- `BootstrapEvent` — discriminated union of narration events: `scope | narrate | build (wraps a SupervisorEvent verbatim) | checklist | improve | deploy | done`; rides the generic surface stream (`EventStream<BootstrapEvent>`).
- `BootstrapResult` — `{ scope, intent, run, passes, blockers, productionGrade, stoppedEarly, deploy? }`.
- Deploy vocabulary: `RenderMode` (`ssr | ssg | spa`), `DeployPlan` (`{ render, target, reason }`), `DeployResult` (`{ deployed, url?, detail? }`), `DeployOutcome`, and the `DeployTarget` adapter interface.

## Facts

- `DeployTarget` is a seam in the same pattern as the runner seam (#109): a target *executes* a `DeployPlan`; *deciding* the plan is the deploy step's job. v1 ships only plan-only + fake targets; real adapters are infra-gated follow-ups.
- `BootstrapScope` is the one upfront question: `'prototype' | 'full'`; only `'full'` runs the checklist loop.
- `LoopPassContext.pass` is 1-based; its `blockers` are the previous checklist's (empty on pass 1).
