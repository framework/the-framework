The `Bootstrap` orchestrator: sequences injected `BootstrapSteps` into scope → build → full-fledged loop → deploy, narrating each phase over `onEvent`.

## TLDR

- `Bootstrap` (and factory `createBootstrap`) owns control flow only — the loop, the production-grade gate, the interrupt; the injected steps own all model/runner work, so the whole flow runs offline against stubs.
- Constructor validates `steps.scope`/`steps.build` (required) and `maxPasses` (positive integer, default 3); throws `TypeError` otherwise.
- `run()` returns a `BootstrapResult`; each phase emits a typed `BootstrapEvent` via `makeEmitter` (throwing observers are isolated).
- `BootstrapAborted` is thrown when the optional `AbortSignal` is found aborted — checked between phases/passes, never mid-step.

## Decisions

- What stack to build on is the agent's call, not the orchestrator's (#545) — build gets only `{ scope, intent }`.
- The full-fledged loop runs only for `scope === 'full'` and only when a `checklist` step exists; prototype scope skips it entirely (so `productionGrade` stays false — it is never claimed ungated).
- `improve` runs only *between* passes (never after the last checklist), each time against the previous pass's blockers.
- The deploy phase is not gated on the loop: it runs for prototypes too, receiving `productionGrade` so the step can factor readiness in.
- Designed to pair with `launchAutopilot<BootstrapEvent, BootstrapResult>` for detached runs with a replayable narration stream.

## Facts

- `productionGrade = passes > 0 && blockers.length === 0`; `stoppedEarly` is true only when the loop hit `maxPasses` with blockers still open.
- Passing is decided by `isPassing(verdict)` from `../loop/verdict.js` (empty `blockers`).
- Build-phase Supervisor events are forwarded verbatim wrapped as `{ type: 'build', event }`.

## Flows

- `run()`: `steps.scope()` → emit `scope` → `steps.build({scope,intent,onEvent,signal})` → [full scope] loop pass 1..maxPasses: `steps.checklist()` → emit `checklist` → if not passing and passes remain: emit `improve` → `steps.improve()` → [optional] `steps.deploy({scope,intent,productionGrade})` → emit `deploy` → emit `done` → return result.
- abort: `throwIfAborted()` before scope, build, each checklist, each improve, and deploy → throws `BootstrapAborted`.
