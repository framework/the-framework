Tests for `loop.ts` — covers matching, dispatch, failure policy, verdict gating, ledger exposure, and `watch`.

## TLDR

- Matching: chain resolution per kind against `defaultLoops()`, cross-loop concatenation + de-dupe.
- Dispatch: in-order execution, `matched:false` no-op, N fresh-context passes with incrementing `pass`, unknown-prompt flagged without throwing and gating a blocking chain.
- Failure policy: default continues past a throwing prompt; `continueOnError: false` stops with `gate-stop`.
- Verdict gating: blockers → `ok:true` but `passing:false`; empty blockers passes; blockers gate a blocking chain; no verdict in text still passes (backward compatible); `verdict: null` ignores blockers.
- Ledger reaches prompts via `ctx.ledger`; `watch()` preserves event order; a throwing `onEvent` observer is isolated.
