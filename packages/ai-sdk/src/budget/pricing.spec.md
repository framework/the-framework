Model pricing catalog (`<provider>/<model>` → USD per 1k tokens) plus cost estimation helpers and the budget error classes.

## TLDR

- `ModelPricing`: snapshot-dated catalog covering Anthropic, OpenAI, Google, Bedrock (Claude family), xAI, DeepSeek, Mistral, Groq, Cohere; each `ModelPriceEntry` has `inputPer1k`/`outputPer1k` and optional `cacheReadPer1k`/`cacheWritePer1k`.
- `estimateCost(model, promptTokens, completionTokens, pricing?)` — returns `0` for unknown models so eval cost columns never crash on a fresh model.
- `assertKnownModelPricing()` — throws `UnknownModelPricingError` for unpriced models; used by `withBudget` so apps fail at boot, not on first prompt.
- `BudgetExceededError` — carries `userId`/`period`/`spent`/`cap`; thrown by the budget middleware when a debit would exceed a cap.

## Decisions

- Two lookup postures on purpose: eval reporting tolerates unknown models (`estimateCost` → 0) while budget enforcement fails loud (`assertKnownModelPricing` throws) — silently zero-costing a typo'd model would defeat enforcement.
- Negotiated rates are applied by spreading: `pricing: { ...ModelPricing, '<id>': {...} }` — no mutation API.

## Facts

- Catalog snapshot date: 2026-05-11; every entry carries `_snapshotDate`, surfaced in `UnknownModelPricingError` messages for stale-catalog auditing.
- Cache-rate conventions encoded in the entries: Anthropic write = 1.25× input / read = 0.1×; OpenAI prefix-cache read = 0.5×; Google cachedContent read = 0.25×; only Anthropic charges a write premium.
- Cache fields are currently unused by the middleware — `TokenUsage` doesn't yet expose cache deltas, so all input tokens bill at `inputPer1k`.
- Part of #A6 (Phase 3 budget middleware); also consumed by `@gemstack/ai-sdk/eval` for report cost columns (re-exported there).
