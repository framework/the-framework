The supervisor/worker topology — plan, dispatch, synthesize: a planner breaks the task into subtasks, worker agents run them in parallel under guardrails, and a synthesizer folds the results into one answer.

## TLDR

- Control policy over single agents, not a bigger agent: it owns which agents run, in what order, how results combine, and when to stop.
- Each subtask routes to its worker: one agent for everything, a named pool the plan picks from, or custom routing.
- Guardrails mark the run stopped-early: a cap trims an oversized plan, and a token budget stops new dispatches once crossed (in-flight workers finish, so spend can overshoot a little).
- One subtask's failure — a crash, an unknown worker name, or a worker pausing to ask for approval (workers here are autonomous; there is no resume yet) — fails that subtask alone; siblings finish and the run still synthesizes.
- Progress streams as events; a broken observer is ignored rather than allowed to abort the run.

## Rationales

- Reported token spend counts only the workers: the planning and synthesis stages hand back data, not usage, so their spend is invisible to the supervisor.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
