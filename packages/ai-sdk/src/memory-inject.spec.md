`withMemoryInject(spec, opts)` — pre-prompt middleware that recalls user facts relevant to the latest user message and prepends them to the system message as a `<user-memory>…</user-memory>` block (#A4 Phase 2).

## TLDR

- Runs in `onStart` (async — `onConfig` is sync but `recall()` isn't); mutates `ctx.messages[0]` in place, which is the same array reference the loop sends to the provider.
- Recall query = text of the latest `role:'user'` message only; `spec.tags`/`spec.injectLimit` forwarded to `recall()`; `spec.injectTokenBudget` enforced by `applyTokenBudget`.
- Silently no-ops when: no user message (continuation flow), no registered `UserMemory`, empty recall, budget too small for even one fact, or first message isn't `system`.

## Decisions

- Budget trimming sorts by score descending with `undefined → 0.5` so unscored user-asserted facts tie with mid-confidence extracted facts; renders incrementally so the wrapper tags count against the budget.
- Default token estimator is `ceil(len/4)` — good enough for English, avoids a mandatory tokenizer dependency (pass `opts.estimateTokens` for accuracy).
- "Latest user message" (not full history) as the recall query: the current request maps best to recall accuracy; history is the persistence layer's job.

## Facts

- The fenced `<user-memory>` tag is a deliberate stable hook for downstream detection/stripping (telescope, evals) and signals framework-provided content to the model.
- `lookup` defaults to `resolveUserMemory`; tests override via `opts.lookup`.
