Driver-backed implementations of ai-autopilot `Bootstrap`'s injectable steps (option A, #166): build/improve are prompts that let the wrapped agent's own loop do the work; the checklist re-prompts and gates on a `{ blockers }` verdict.

## TLDR

- Prompt composers: `buildPrompt` (greenfield), `extendPrompt` (#185, existing codebase: extend, don't re-scaffold), `scaffoldPrompt` (#182, hard "create from scratch" directive), `PRODUCTION_GRADE_PROMPT` + `improvePrompt`.
- `driverBuild()`: one build turn wrapped in synthetic Supervisor plan/dispatch events; picks extend vs greenfield by whether the workspace holds source at build time; re-prompts once with `scaffoldPrompt` when the workspace is still empty after the turn (#182) — unless the turn ended on an await block, which means the agent stopped on purpose to ask (#337/#339).
- `driverChecklist()`: re-prompts with the production-grade checklist and parses the verdict — failing closed: no parseable `{ blockers }` yields `MISSING_VERDICT_BLOCKER` so the loop re-prompts rather than declaring production-grade off an unverifiable reply.
- `domainLoopChecklist()` (#252): each checklist pass dispatches a loop event (default `major-change`) through the preset's `LoopEngine`; no matching loop falls back to the built-in checklist so a run is never silently unreviewed. `verdictFromLoopRun()` unions every prompt's blockers; a prompt that failed to execute becomes a blocker (an errored review is not a pass), one that ran without a verdict is advisory.
- `driverImprove()`: fixes the current blockers, switching to `scaffoldPrompt` when the workspace is still empty (the "smallest changes" framing would block building an app that doesn't exist).
- `driverLoopPrompts()`: materializes a domain preset's `Prompt` bodies as driver-backed `LoopPrompt`s (one fresh `session.prompt` per pass).
- `continueAfterChoice()`: the re-prompt after a user answers an await gate — a fresh turn so the agent re-reads the workspace.
- `decideDeploy()` (plan-only narration) / `deployWith()` (executes a real `DeployTarget`; real targets never throw, failures come back as `{deployed: false}`).
- `isWorkspaceEmpty()`: "no source file the agent could have produced" — lockfiles, dotfiles, dependency/output dirs don't count; depth-capped at 6, stops at the first real file, never throws.

## Decisions

- Scaffold-vs-normal is read at the moment each step decides (`shouldScaffold`), since the workspace changes as the agent works; gated on `verifyWorkspace` so the fake driver (writes nothing, workspace always reads empty) stays deterministic on the greenfield path.
- Driver turns report `ZERO_USAGE` in the synthetic SupervisorRun and `ok: true` — the driver owns pass/fail; real usage accounting rides the driver event stream instead.
- The stack is the agent's call (#545): `buildPrompt` names no framework.
