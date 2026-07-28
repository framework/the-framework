Tests for `steps.ts` — the default step wirings over real primitives (`Supervisor` via `AiFake`, real `LoopEngine`), plus two offline end-to-end `Bootstrap` runs with the default steps.

## TLDR

- `supervisorBuild`: forwards Supervisor `plan`/`synthesize` events as narration; refuses to start on an already-aborted signal.
- `loopChecklist`: reads the `{ blockers }` verdict from the production-grade prompt (fenced JSON), treats a missing verdict as a blocker.
- `loopImprove`: firing `major-change` runs the review chain.
- End-to-end: blocker → improve → clean second pass → `productionGrade`, with `agentDeploy` deciding SSR/dokploy last and reaching a `FakeDeployTarget`.

## Facts

- Two tests pin #974: `loopChecklist`'s default event kind must be one `defaultLoops()` actually defines, so the documented default path (`defaultLoops()` + no explicit `kind`) reaches `productionGrade`.
- The end-to-end test's `AiFake.respondWithSequence` order encodes the model-call order: build worker first, deploy decision second.
