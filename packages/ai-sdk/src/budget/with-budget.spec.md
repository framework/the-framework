`withBudget()` — per-user spend-cap middleware (#A6 Phase 3) that pre-debits an estimated input cost before each model call and trues up with actual usage afterwards.

## TLDR

- `onIteration` (per step, incl. step 1): resolve user via `opts.user(ctx)` (null ⇒ bypass entirely), `assertKnownModelPricing(ctx.model)`, resolve `{ daily?, monthly? }` caps via `opts.budget()`, estimate input cost from the live messages, `checkAndDebit` each defined period; on denial call `onExceeded` and then always throw `BudgetExceededError`.
- `onUsage`: compute actual cost from provider-reported `promptTokens`/`completionTokens`, debit only the positive delta vs the pre-debit — passing `cap: Number.MAX_SAFE_INTEGER` so the true-up always records (enforcement already happened).
- Run state (`userId`, locked caps, `pendingEstimate`) is stashed on the middleware context under `Symbol.for('rudderjs.ai.budget.state')` and cleared each usage so tool round-trips start fresh.
- Default token estimator is `Math.ceil(text.length / 4)`; pass `estimateTokens` (e.g. tiktoken-backed) for tight caps.

## Problems

- Concurrent requests must not both pass the cap check before billing — solved by making the estimate a real atomic debit (reservation) instead of check-then-bill.

## Decisions

- No refunds on provider errors: the pre-debit stays spent (distinguishing partial-credit cases is not worth it); apps needing refund-on-error subscribe via `onError` and call storage directly.
- Overestimates are accepted as small over-charges; only underestimates are trued up — a streamed response can't be unspent.
- If a custom `onExceeded` fails to throw, the middleware throws the default error anyway — a denied debit always aborts the run before the model call.
- Input estimation concatenates all messages into one string so tiktoken-backed estimators pay a single tokenizer pass.

## Facts

- The pre-debit runs in `onIteration`, before `prepareStep`/`onConfig('beforeModel')` — model swaps applied by those later hooks are not reflected in the estimate (accepted for v1).
- Cached requests bill at full `inputPer1k` (no `TokenUsage` cache deltas yet — phase 3.x follow-up).
- A missing pricing entry at `onUsage` time (mid-run model failover) silently skips the true-up rather than throwing.
- Only `text` content parts count toward the estimate; images/documents contribute 0 tokens.

## Flows

- budgeted step: `onIteration` → `user()`/`budget()` → `assertKnownModelPricing()` → `estimateInputCostUsd(messages)` → `storage.checkAndDebit()` per period (throw on deny) → stash `BudgetState` → model call → `onUsage` → `actualCost − pendingEstimate` → debit positive delta per period.
