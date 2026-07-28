`Supervisor` — the plan → dispatch → synthesize orchestrator: a control policy over ai-sdk's single-agent primitives that owns which agents run, in what order, how results combine, and when to stop.

## TLDR

- `run(task)`: plan (assign missing ids as `subtask-N`, trim to `maxSubtasks` emitting `plan-trimmed` + `stoppedEarly`), dispatch via `runPool` (default concurrency 4; budget predicate `usage.totalTokens >= budget.maxTotalTokens`), synthesize (default `defaultSynthesize`, no LLM call).
- `resolveRouter` turns `workers` into a `WorkerRouter`: a function passes through, an `Agent` instance becomes a constant router, a Record routes by `subtask.worker` — a missing `worker` key or unknown name throws a descriptive error (which isolation converts into a failed result).
- Per-subtask error isolation: `runSubtask` catches worker throws into `{ ok: false, error, usage: ZERO }`; siblings continue.
- A worker that *pauses* (`pendingClientToolCalls` / `pendingApprovalToolCall`) is surfaced as a failed subtask with an explanatory error — the seed runs autonomous workers and durable pause/resume is a deferred adapter.
- `onEvent` is wrapped by `makeEmitter` (observer throws are logged and swallowed). Options validated at construction (`plan` function, `workers` present, positive integer `concurrency`/`maxSubtasks`); `run()` rejects an empty/blank task.
- Aggregate `usage` counts dispatch only (planner/synthesizer contracts return data, not usage); `stoppedEarly` = plan trimmed OR budget stopped dispatch.

## Facts

- Budget can overshoot: the predicate only gates *new* claims, so in-flight workers finish and the skipped count is `plan.length - results.length` (emitted in `budget-exceeded`).

## Flows

- run: `plan(task)` → assign ids / trim to cap (emit `plan-trimmed`) → emit `plan` → `runPool(plan, concurrency, dispatch, budget?)` where dispatch = emit `dispatch-start` → `route(subtask).prompt(description)` → accumulate usage → emit `dispatch-result` → if stopped: emit `budget-exceeded` → emit `synthesize` → `synthesize(task, results)` → `{ text, plan, results, usage, stoppedEarly }`.
