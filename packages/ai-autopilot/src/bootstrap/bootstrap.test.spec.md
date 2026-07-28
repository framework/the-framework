Tests for `bootstrap.ts` — drives the `Bootstrap` orchestrator entirely against stub steps (no model, no runner).

## TLDR

- Happy path: scope → build → loop sequencing, event order (`scope, narrate, checklist, done`), scope/intent handed to build.
- Full-fledged loop: improve runs against prior blockers until clean; `maxPasses` stop sets `stoppedEarly` and improve runs only between passes.
- Prototype scope: checklist never runs, `passes === 0`, `productionGrade === false` (not claimed ungated).
- Deploy phase: runs last (`narrate, deploy, done` tail), optional, receives `productionGrade`, and runs for prototypes too.
- Interrupt: abort during build rejects with `BootstrapAborted`; pre-aborted signal prevents even `scope` from running.
- Isolation: a throwing `onEvent` observer never breaks the run; constructor rejects missing steps and `maxPasses: 0`.
