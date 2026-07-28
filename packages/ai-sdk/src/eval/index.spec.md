`@gemstack/ai-sdk/eval` core (#A5): suite definition, built-in assertion metrics, the serial case runner, and the console reporter.

## TLDR

- `evalSuite(name, spec)` — validates and freezes `{ agent: () => Agent, cases, timeout?, metadata? }`; meant to be default-exported from `evals/*.eval.ts` for CLI auto-discovery.
- Built-in `Metric`s (`(response, ctx) => MetricResult`): `exactMatch`, `regex`, `llmJudge` (one-shot anonymous judge agent + `Output.object`-shaped `{pass, reason}` JSON), `jsonShape` (zod parse after stripping ```json fences, reports the failing issue path), `semanticMatch` (cosine over `AI.embed`, threshold default 0.85), `tokenCost` (multi-step usage rollup ≤ threshold), `compose` (in order, short-circuit on first failure).
- `runSuite(suite)` — serial runner: per-case timeout, agent-throw or assert-throw becomes a `failed` case (never an exception), skip via `skip: true | string`; emits `agent.eval.completed` observer events per case; rolls up passed/failed/skipped, cost, tokens, duration into `SuiteReport`.
- `reportConsole(report, sink?)` — glyph table (✓/✗/○) with per-case ms/cost/tokens; returns the report for chaining. Re-exports the json/html reporters, fixture I/O, and `estimateCost`/`ModelPricing` from `../budget/pricing.js`.

## Decisions

- Serial execution on purpose — correct under any provider rate limit; parallelism deferred until real-world judge-model rate-limit shape is understood.
- `Metric` has no usage slot in its return type, so `llmJudge`/`semanticMatch` stamp judge/embed tokens onto the response via a `Symbol.for('rudderjs.ai.eval.extraUsage')` side-channel the runner consumes into the case's tokens/cost.
- A broken judge/embed (network, parse, missing provider) is `pass: false` with the error in `reason` — never a silent pass.
- `cosineSimilarity` is inlined locally so `eval/` doesn't pull in memory-embedding (which depends on an ORM).
- Suites are plain frozen objects from a function factory (not a class) — trivially loadable via dynamic import, no forgotten-`new` footgun.

## Facts

- Cost estimation uses `ag.model() ?? 'unknown/unknown'`; an agent without a declared model estimates as $0 (unknown-model rate). Extra judge/embed tokens are approximated as completion-side cost.
- `semanticMatch`'s 0.85 default is deliberately tighter than `EmbeddingUserMemory`'s 0.5 retrieval floor — assertion vs ranking.
- Case tokens include BOTH the agent under test and judge/embed calls made by the assertion.
- `reportConsole`'s local `formatCost(cents)` parameter is misnamed — values are USD (the html reporter's twin names it `usd`).
- Well-known `metadata` keys (`owner`, `lastReviewed`, `ticket`) get formatted headings in the HTML report; extra string keys render generically.

## Flows

- `runSuite`: for each case → skipped? record+emit : `runCase` → `factory()` → `ag.prompt(input)` under `runWithTimeout` → `c.assert(response, ctx)` → `consumeExtraUsage` → `CaseResult` → emit `agent.eval.completed` → aggregate `SuiteReport`.
- `llmJudge`: build judge agent (`JUDGE_INSTRUCTIONS` + `Output.object` system prompt) → prompt with criterion/input/response → parse `{pass, reason}` → `attachExtraUsage`.
