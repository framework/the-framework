`runPool` — internal bounded-concurrency worker pool with an optional stop predicate; the dispatch engine under `Supervisor`.

## TLDR

- At most `limit` workers (clamped to `[1, items.length]`) claim items via a shared `next` index; results are collected with indices, sorted, and returned dense — trailing items skipped by `shouldStop` are simply absent, so `results.length < items.length` signals truncation.
- `shouldStop` is checked before each claim; once true, no further items start (in-flight ones finish) and `stopped: true` is reported.
- `@internal`: not re-exported from the package entry; may change without a major bump.

## Decisions

- The bound check runs BEFORE `shouldStop`: with nothing left to claim there is no work to skip, so a budget met exactly by the final item is reported as completion (`stopped: false`), not truncation — otherwise callers would see a false "guardrail trimmed the plan" signal.
- `Promise.allSettled` over the workers so one rejecting worker cannot orphan its siblings into unhandled rejections; the first error is rethrown once all have drained.
