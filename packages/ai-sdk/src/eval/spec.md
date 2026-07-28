`@gemstack/ai-sdk/eval` subpath (#A5): eval framework — suites, metrics, runner, reporters, and record/replay fixtures.

## TLDR

- `index.ts` — `evalSuite`, built-in metrics (`exactMatch`/`regex`/`llmJudge`/`jsonShape`/`semanticMatch`/`tokenCost`/`compose`), serial `runSuite`, `reportConsole`; re-exports everything below plus pricing.
- `json-reporter.ts` — flat, stability-contracted `SuiteJson` for CI.
- `html-reporter.ts` — single-file offline HTML report with expandable case rows.
- `fixtures.ts` — versioned record/replay fixture format + I/O under `evals/__fixtures__/`.

## Facts

- The `ai:eval` CLI (discovery of `evals/*.eval.ts`, `--json`/`--html`/`--record`/`--replay` flags) is a Rudder binding living in `@rudderjs/ai`; this directory is the engine it drives.
- Cost columns come from `../budget/pricing.ts` (`estimateCost` returns 0 for unknown models — reports never crash on a fresh model).
- Eval runs use the same `Agent` instances as app code (one source of truth) and emit `agent.eval.completed` events through `aiObservers`.
- Related tests live one level up: `src/eval.test.ts`, `src/eval-fixtures.test.ts`.
