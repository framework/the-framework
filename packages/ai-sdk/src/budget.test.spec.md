Tests for `budget/pricing.ts` — catalog hygiene, `estimateCost`, `assertKnownModelPricing`, and `BudgetExceededError`.

## TLDR

- Catalog hygiene: every `ModelPricing` entry has positive input/output per-1k rates and an ISO `_snapshotDate`; cache-read rates ≤ input rate, cache-write ≤ 1.5× input; headline models of every shipped provider must be priced (a provider shipping unpriced means budget/eval cost columns silently produce $0).
- `estimateCost`: `(prompt × inputPer1k + completion × outputPer1k) / 1000`; unknown models return 0 (eval cost columns must not crash on fresh model ids); an override map fully replaces the catalog.
- `assertKnownModelPricing`: strict variant — throws `UnknownModelPricingError` whose message includes the catalog snapshot date (so users can tell stale catalog from a wrong id).
- `BudgetExceededError` carries userId/period/spent/cap and formats them into the message.
