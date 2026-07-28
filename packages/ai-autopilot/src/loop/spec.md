"The loop" (#113) — the event-to-prompt-chain policy engine: an agent declares a semantic `LoopEvent` after doing work, and the matching ordered chain of follow-up prompts (review, security, QA, ...) runs automatically.

## TLDR

- `types.ts` — all loop types (`LoopEvent`, `LoopPrompt`, `Loop`, outcomes, progress) and the design doc-comment.
- `define.ts` / `define.test.ts` — fail-fast `definePrompt`/`defineLoop` validators producing frozen values; `LoopError`.
- `loop.ts` / `loop.test.ts` — `LoopEngine`: match → run chain (N fresh-context passes per prompt) → gate; `watch()` for event streams.
- `policy.ts` / `policy.test.ts` — built-in policy: `LOOP_EVENTS`/`LOOP_PROMPTS` constants and `defaultLoops()`.
- `verdict.ts` / `verdict.test.ts` — the `{ blockers }` verdict convention (`parseVerdict`, `isPassing`) the engine gates on.
- `index.ts` — barrel.

## Facts

- Layering: loops reference prompts by kebab-case id only; bodies come from elsewhere (`../prompts/` library #111, or preset directories). Kinds and prompt data are frozen at definition.
- Gating semantics live in two knobs on `LoopEngine`: `continueOnError` (fire-and-report vs blocking gate) and `verdict` (gate on reported `blockers` vs execution only).
- Prompts may consult the decisions ledger (`../decisions/`) via `ctx.ledger`; progress observers are isolated through `../util/emitter.ts` so they can never abort a run.
