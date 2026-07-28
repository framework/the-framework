Tests for `budget/with-budget.ts` — the per-user spend-cap middleware's bypass, pre-debit, true-up, pricing-override, and multi-step behavior.

## TLDR

- Bypass: null user resolver or empty budget (no daily/monthly caps) never touches storage.
- Pre-debit: estimated input cost (~chars/4 tokens) is debited before the model call; exceeding a cap throws `BudgetExceededError` carrying userId/period/cap; custom `onExceeded` may throw its own class, but if it does not throw the middleware still throws the default (debit must always abort the run); daily and monthly are enforced together, first denial wins; unknown model with strict pricing map throws `UnknownModelPricingError` at iteration time.
- True-up: once real usage arrives the difference to actual cost is debited; no refund when actual < pre-debit (small over-charge accepted); post-debit may push spend past the cap — the response already streamed, the cap bites on the next request.
- Pricing override map replaces the built-in catalog per model; multi-step tool runs pre-debit + true-up per iteration and sum to total actual cost.

## Facts

- `AiFake` registers as provider `__fake__` with model `__fake__/default`; tests pin pricing for that key so they don't depend on the live catalog.
- `storage.checkAndDebit({ costUsd: 0 })` is used as a pure read to peek spend.
