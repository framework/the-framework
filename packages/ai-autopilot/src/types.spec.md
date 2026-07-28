Core supervisor types: `Subtask`/`PlannedSubtask`/`SubtaskResult`/`SupervisorRun`, the `Planner`/`WorkerRouter`/`Synthesizer` stage contracts, the `SupervisorEvent` union, and `SupervisorOptions`.

## Facts

- `Subtask.id` is optional (auto-assigned `subtask-N`); `subtask.worker` keys a `Record<string, Agent>` pool; `workers` may be a single `Agent`, a Record, or a `WorkerRouter` function.
- `SupervisorEvent` variants: `plan` | `plan-trimmed` | `dispatch-start` | `dispatch-result` | `budget-exceeded` | `synthesize`.
- `SupervisorRun.usage` aggregates *dispatched subtasks only* — the `Planner`/`Synthesizer` contracts return data, not usage, so the supervisor cannot observe their token spend.
- `SubtaskResult.ok` is false both for a throwing worker and for one that *paused* (client-tool / approval round-trip); `budget.maxTotalTokens` stops new dispatches but in-flight workers finish, so usage can overshoot slightly.
