Per-user LLM spend budgeting (#A6): pricing catalog, storage contract, and the enforcement middleware.

## TLDR

- `pricing.ts` — `ModelPricing` catalog (USD/1k tokens, snapshot-dated), `estimateCost`/`assertKnownModelPricing`, `UnknownModelPricingError`/`BudgetExceededError`.
- `storage.ts` — `BudgetStorage` contract (atomic `checkAndDebit`), `periodKey` bucketing, `memoryBudgetStorage()` reference impl.
- `with-budget.ts` — `withBudget()` middleware: pre-debit estimated input cost per step, true up on actual usage.

## Facts

- Exported from the main `@gemstack/ai-sdk` entry (no dedicated subpath); `eval/` re-exports the pricing pieces for report cost columns.
- Core invariant spanning the files: `checkAndDebit` is atomic, and the middleware relies on that to make the pre-debit a genuine reservation against concurrent requests.
- Production ORM-backed storage (`ormBudgetStorage`, #A6 Phase 4) lives in `@rudderjs/ai/budget-orm`, implementing the same `BudgetStorage` contract defined here.
