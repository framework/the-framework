Process-wide pub/sub registry (`aiObservers`) for agent-execution events, consumed by observability collectors (dashboard recording).

## TLDR

- `AiEvent` union: `agent.completed` / `agent.failed` (full run: steps, per-tool-call args/result/duration/needsApproval, tokens, duration, streaming flag, conversationId, failoverAttempts, error), `agent.step.completed` (per iteration, cumulative tokens/duration), `agent.eval.completed` (#A5 eval runner: suite/case/status/pass/score/tokens/cost).
- `subscribe(fn)` returns an unsubscribe; `emit()` is called by `runAgentLoop()`/`runAgentLoopStreaming()`; `reset()` is a public test-cleanup hook.

## Facts

- Observer exceptions are swallowed in `emit()` — observability must never break agent runs.
- Singleton lives at `globalThis.__rudderjs_ai_observers__` so it survives the package being loaded twice (bundled + node_modules copy), same pattern as `AiRegistry`.
- Skipped eval cases still emit so dashboards can show coverage gaps; `score` present only for graded metrics.
