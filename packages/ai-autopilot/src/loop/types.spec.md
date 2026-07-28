Type definitions and doc-model for the loop: events, prompts, policy loops, outcomes, and progress events.

## TLDR

- `LoopEvent` — semantic trigger the agent declares after work (`kind` selects loops; `summary`/`paths`/`meta` are prompt context).
- `LoopContext` — per-pass input (`event`, 1-based `pass`, `passes`, optional `ledger`).
- `LoopPrompt`/`LoopPromptSpec` — id + `passes` + `run` thunk; `run` must build fresh context per invocation.
- `Loop`/`LoopSpec` — `on` kinds → ordered `run` prompt-id chain.
- `PassResult`, `PromptOutcome`, `LoopRunResult`, `LoopProgress` — result/progress shapes.

## Facts

- `PromptOutcome.ok` ≠ `PromptOutcome.passing`: `ok` = final pass executed without throwing; `passing` additionally requires an empty `blockers` list when a verdict was parsed, and equals `ok` when no verdict parser is configured. `continueOnError: false` gates on `passing`.
- Design intent (module doc): the loop is *semantic* — a kind of change selects a set of prompts — not command-driven or run-on-every-PR; it is the web-app-specific orchestration layer generic harnesses lack.
