Default wirings of scale mode onto real primitives: an `ai-sdk`-agent-backed `Regenerate` and a `LoopPrompt` that drops the maintainer into the loop (#113).

## TLDR

- `agentOverview(overviewer, opts)` — returns a `Regenerate` that prompts the given agent for a structured `{ summary, sections }` overview via `Output.object` + a zod schema; the prompt concatenates instructions (default `DEFAULT_OVERVIEW_INSTRUCTIONS`, overridable), a `# Why now` block with `ctx.reason`, the serialized previous overview when present (so the model revises rather than rewrites blind), and `output.toSystemPrompt()`.
- `overviewLoopPrompt(maintainer, opts)` — a `LoopPrompt` (default id `code-overview`) whose `run` calls `maintainer.handle(ctx.event)` and reports either `Refreshed CODE-OVERVIEW.md: <reasons>` or that the change was not material.

## Decisions

- Model + runner stay injected (the agent is passed in; regeneration is a function) so the maintainer's policy is testable offline against a stub `regenerate`.
- The agent is expected to carry workspace-reading tools (e.g. `runnerTools(session)`); this file does not attach any.

## Facts

- Adding the prompt id to a loop (e.g. on `major-change`) makes the overview self-maintain — this is the "regen via the loop" wiring issue #113 asks for.
