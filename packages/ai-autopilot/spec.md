`@gemstack/ai-autopilot` — the orchestration ("director") layer for `@gemstack/ai-sdk` agents: a Supervisor that plans, dispatches subagents (bounded concurrency + budget guardrails), and synthesizes the result, plus the autonomy machinery around it (runner sandboxes, event surfaces, decisions ledger, review loop, prompt/domain presets, bootstrap mode, code-overview scale mode, framework detection).

## TLDR

- `src/` — the implementation (see `src/.spec.md` for the subsystem map); `src/index.ts` is the single export entry (`dist/index.js`).
- `prompts/` — non-source: the shipped stack-aware prompt bodies as markdown (`review-tldr`, `review-thorough`, `code-quality`, `security`, `refactor`, `ux`, `qa`, `knowledge-base`, `production-grade`) — the loop's bodies and the package's main open-source contribution surface.
- `presets/` — non-source: five built-in domain presets (`software-development`, `web-development`, `data-science`, `product-management`, `biological-science`), each a directory of markdown (`preset.md` manifest + `loops/` + `prompts/`).
- `harness/` — opt-in browser harness proving `WebContainerRunner` boot-and-serve (cannot run under `node --test`).
- Packaging: ESM-only, Node >= 22.12, publishes `dist` + `prompts` + `presets`; deps `@gemstack/ai-sdk`, `@gemstack/ai-skills`, `zod`; `@webcontainer/api` is an *optional* peer dep (browser-only, lazily imported).

## Decisions

- Layering: ai-sdk owns the single-agent loop and handoff/subagent primitives; autopilot exists only as the topology / control-policy layer over many runs.
- Behavior ships as data where possible: prompt bodies and domain presets are markdown files, so contributors improve them by editing prose, not code.

## Facts

- Tests compile first, then run: `tsc -p tsconfig.test.json && cd dist-test && node --test` (tsconfig.build.json / tsconfig.test.json split).
- `@gemstack/the-framework` surfaces the domain presets to end users as `--preset`.
