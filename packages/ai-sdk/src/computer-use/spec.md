`@gemstack/ai-sdk/computer-use` subpath (#A7): Anthropic computer-use — action schema, Playwright executor, and the agent-tool factory.

## TLDR

- `actions.ts` — `ComputerAction`/`ComputerActionResult` types mirroring Anthropic's `computer_20250124` schema, executor cursor state, structural `PageLike` (no hard Playwright dep).
- `playwright.ts` — `executeComputerAction()` dispatcher + key/modifier normalization; errors returned, never thrown.
- `tool.ts` — `computerUseTool({ page })` factory, `COMPUTER_USE_MARKER`, providerHint that makes the Anthropic adapter emit the native tool block.
- `errors.ts` — `ComputerUseProviderError`, `ComputerUseLimitError`, `isAnthropicLikeModel()`.
- `index.ts` — public re-exports + usage docs.

## Facts

- Anthropic-only in v1 (`anthropic/*`, `bedrock/*anthropic.*`; explicitly not OpenRouter-routed Claude) — enforced at tool construction when `model` is passed; plan: `docs/plans/2026-05-10-ai-computer-use.md`.
- The caller owns the Playwright lifecycle (launch, `setViewportSize`, navigate, close); the SDK only receives a `PageLike`.
- Cross-file contract: `tool.ts` formats screenshot results as image `ContentPart[]` which the Anthropic adapter's tool-message handler serializes as native image blocks; action failures propagate as throws that the agent loop converts to `is_error` tool-results.
- Related tests live one level up: `src/computer-use.test.ts`, `src/computer-use-tool.test.ts`, `src/computer-use-anthropic.test.ts`.
