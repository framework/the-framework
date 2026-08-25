# Bug analysis: packages/framework/src/driver/fake.test.ts

## Business logic (high-level)

Five tests, one per bullet of `fake.SPEC.md`, verifying the offline driver's contract:

1. **Script order + last-repeats (L6-13).** Two scripted turns, three prompts: `one`, `two`, `two`.
   This is the load-bearing test for the "short script never starves a long agent" rule and it is
   genuinely falsifiable — an implementation that ran off the end would throw or return
   `undefined.text`, and one that restarted the script would return `one`. The
   `deepEqual(session.prompts, ['a','b','c'])` also pins the recording order, which assertions
   elsewhere depend on.
2. **Dynamic answers (L15-20).** `respond` receives both the prompt and the 0-based index; asserting
   `'0:HI'` then `'1:YO'` pins both the index base and that the index advances per prompt. It also
   implicitly pins `asTurn`'s string normalization, since `respond` returns a bare string.
3. **Event stream (L22-32).** Asserts the exact event-*type* sequence
   `['start','action','action','text','result']`, which catches a reordering, a dropped `text`, or a
   duplicated `result`. It checks types only, not payloads, so a wrong `label` or wrong `text` would
   slip through — but `turn.sessionId` is separately asserted, and the payloads are pinned by
   tests 1-2. Acceptable coverage rather than a hole.
4. **Seeded files (L34-39).** Both arms: a hit returns the contents, a miss rejects.
   `assert.rejects(() => …)` is the correct form (a bare `assert.rejects(session.readCode(...))`
   would also work but the thunk form is safer against a synchronous throw).
5. **Abort (L41-45).** `AbortSignal.abort()` on the session, then `prompt` must reject. This is the
   SPEC's "an agent already stopped refuses further prompts".

**Do the tests verify what they claim?** Yes. Every test awaits, none can pass vacuously, and each
would fail against a plausible wrong implementation. Notable *uncovered* behaviours, all deliberate
or covered elsewhere: `respond` taking precedence over `turns` when both are given; the per-prompt
`opts.signal` abort (only the session signal is tested, though the implementation checks both on the
same line); `usage` being forwarded onto the turn and the `result` event; a throwing `onEvent`
being swallowed by `makeEmit` (covered by `session-support`'s own tests); and that a refused prompt
consumes no script entry. None of these gaps hides a defect — the implementation is a handful of
lines and each was read directly.

## Functions (low-level)

- **`test('replays scripted turns in order and repeats the last')`** — awaits each prompt
  individually and asserts `.text`; the third call is the off-by-one boundary (`Math.min(2, 1)`),
  which is precisely where an index bug would appear. Verdict: correct.
- **`test('answers dynamically when respond is given')`** — verdict: correct.
- **`test('emits start, actions, text, result events')`** — collects events via `onEvent` and maps
  to `type`. Since the fake's `prompt` emits synchronously, no event can arrive after the assertion.
  Verdict: correct.
- **`test('readCode returns seeded files and rejects unknown ones')`** — uses `readCode!` because the
  seam declares it optional; the non-null assertion is a type-level convenience, not a runtime risk.
  Verdict: correct.
- **`test('rejects when the session signal is aborted')`** — verdict: correct.

## Bugs found

None found.
