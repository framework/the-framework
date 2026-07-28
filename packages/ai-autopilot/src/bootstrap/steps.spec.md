Default wirings of the bootstrap steps onto the real primitives — `Supervisor` for build, `LoopEngine` for checklist/improve — each a thin adapter from primitive I/O to the step contract.

## TLDR

- `supervisorBuild({ plan, workers, … })` — build step: constructs a `Supervisor` per call, forwards its events to bootstrap's narration via `ctx.onEvent`, task text defaults to `"Build the app.\n\n# Goal\n<intent>"` (overridable via `task`).
- `loopChecklist({ loop, kind?, promptId? })` — fires a check event into the `LoopEngine` and returns the `Verdict` the production-grade prompt reported.
- `loopImprove({ loop, kinds? })` — fires change events so the loop's review/QA chains run with fresh context before the next checklist; the prompt agents (which carry the runner tools) do the actual fixing.

## Decisions

- The Supervisor has no native abort, so `supervisorBuild` honors `signal` only by refusing to start when already aborted.
- A checklist run whose prompt returns no parseable verdict is itself a blocker: `checklist "<promptId>" did not return a verdict` — the checklist must return one to pass.
- On re-checks, `loopChecklist` summarizes as `Re-check after addressing: <blockers>`; `loopImprove` as `Address blockers: <blockers>` — the blockers travel through the loop event's `summary`.

## Facts

- Defaults come from `../loop/policy.js`: checklist kind `LOOP_EVENTS.productionCheck` (`production-check`), verdict prompt `LOOP_PROMPTS.productionGrade` (`production-grade`), improve kinds `[LOOP_EVENTS.majorChange]` (`major-change`) — kinds `defaultLoops()` actually defines (#974 regression).
- The verdict is read from `result.outcomes.find(o => o.promptId === promptId)?.verdict`.

## Flows

- checklist: `loop.handle({ kind, summary })` → find outcome by `promptId` → its `verdict` (or the missing-verdict blocker).
- improve: for each kind → `loop.handle({ kind, summary })` (sequential).
