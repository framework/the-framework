Driver-backed implementations of ai-autopilot `Bootstrap`'s injectable steps (option A, #166): build/improve are prompts that let the wrapped agent's own loop do the work; a domain preset's review loop gates on the `{ blockers }` verdicts its prompts report. No built-in review (#1372): the agent is a black box, so a run reviews only what the user opted into (a preset) or what is mechanically checkable (the serve gate).

## TLDR

- Prompt composers: `buildPrompt` (greenfield), `extendPrompt` (#185, names the existing codebase and the intent; the how-to-behave rules were dropped in #1224, the `set-scope` ask in #1372 with the review gate it existed to skip), `scaffoldPrompt` (#182, hard "create from scratch" directive), `improvePrompt`.
- `driverBuild()`: one build turn wrapped in synthetic Supervisor plan/dispatch events; picks extend vs greenfield by whether the workspace holds source at build time; re-prompts once with `scaffoldPrompt` when the workspace is still empty after the turn (#182) — unless the turn ended on an await block, which means the agent stopped on purpose to ask (#337/#339).
- `domainLoopChecklist()` (#252): each checklist pass dispatches a loop event (default `major-change`) through the preset's `LoopEngine`; no matching loop blocks nothing (#1372 — the user opted into this preset's reviews, not a substitute; the built-in-checklist fallback is gone). `verdictFromLoopRun()` unions every prompt's blockers; a prompt that failed to execute becomes a blocker (an errored review is not a pass), one that ran without a verdict is advisory.
- `driverImprove()`: fixes the current blockers, switching to `scaffoldPrompt` when the workspace is still empty (the "smallest changes" framing would block building an app that doesn't exist).
- `driverLoopPrompts()`: materializes a domain preset's `Prompt` bodies as driver-backed `LoopPrompt`s (one fresh `session.prompt` per pass).
- `continueAfterChoice()`: the re-prompt after a user answers an await gate — a fresh turn so the agent re-reads the workspace.
- `decideDeploy()` (plan-only narration) / `deployWith()` (executes a real `DeployTarget`; real targets never throw, failures come back as `{deployed: false}`).
- `isWorkspaceEmpty()`: "no source file the agent could have produced" — lockfiles, dotfiles, dependency/output dirs don't count; depth-capped at 6, stops at the first real file, never throws.

## Decisions

- Scaffold-vs-normal is read at the moment each step decides (`shouldScaffold`), since the workspace changes as the agent works; gated on `verifyWorkspace` so the fake driver (writes nothing, workspace always reads empty) stays deterministic on the greenfield path.
- Driver turns report `ZERO_USAGE` in the synthetic SupervisorRun and `ok: true` — the driver owns pass/fail; real usage accounting rides the driver event stream instead.
- The stack is the agent's call (#545): `buildPrompt` names no framework.
