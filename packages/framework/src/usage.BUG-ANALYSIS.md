# Bug analysis: packages/framework/src/usage.ts

## Business logic (high-level)

A running total of one agent's own spend (#322): the four `DriverUsage` token counters plus a turn
count, folded turn by turn, with a budget cap gating on the result. Explicitly *not* the account's
subscription quota — that arrives separately as `DriverRateLimit`.

The single subtle invariant is #540's: **an unpriced run must total no cost at all, not `$0`.** A
`costUsd: 0` total would read as "this agent was free" on every surface and would make a budget cap
never fire for the wrong reason. The implementation keeps `costUsd` *absent from the object* (not
merely `undefined`) until a turn actually reports a price, which is why `add` rebuilds the object
with a conditional spread rather than assigning a field.

This is upheld end-to-end: `driver/claude-code.ts` L332 and `driver/codex.ts` both omit `costUsd`
rather than emitting 0, so the "no price" case reaches the meter as an absent field and never as a
`0` that would flip the total into existence.

Lifecycle: one meter per agent run; `add` is called synchronously from the driver's usage handler,
so there is no concurrency. No I/O, nothing to leak.

## Functions (low-level)

### `UsageTotals` (L8) / `ZERO` (L18)

`ZERO` deliberately has no `costUsd` key. Every construction of state goes through `{ ...ZERO }` or
`add`'s rebuild, so the absent-key property is preserved. Correct.

### `UsageMeter.add(usage)` (L43)

- `costUsd` folding: an absent per-turn price keeps whatever the total already had (possibly
  absent); a present price adds to `?? 0`. So a mixed run totals only the priced turns, which the
  test at `usage.test.ts` L48 calls out as "what we know was spent".
- The conditional spread `...(costUsd === undefined ? {} : { costUsd })` is what keeps the key
  absent; an `exactOptionalPropertyTypes`-style assignment would have produced `costUsd: undefined`,
  which serializes into JSON as a missing key but fails `'costUsd' in totals` — the test asserts
  the `in` form, so the stricter behaviour is pinned.
- Token folding is plain addition; the state is replaced rather than mutated, so a snapshot taken
  earlier is unaffected.
- `turns` counts every call to `add`, i.e. every turn that reported usage — matching the field's
  doc.
- Edge cases: a turn with an explicit `costUsd: 0` *does* materialize the key (total becomes `0`),
  which is correct — that is a reported price of zero, not an unpriced turn, and no driver in this
  repo emits it. Negative or `NaN` inputs would propagate, but both drivers sanitize with
  `Number.isFinite` before constructing `DriverUsage`.
- Floating-point: `0.02 + 0.02 === 0.04` exactly (doubling a double is exact), so the test's
  `deepEqual` on `0.04` is not fragile; longer runs will accumulate ordinary float drift, which is
  irrelevant at the `toFixed(4)` precision every surface prints.
- Verdict: correct.

### `UsageMeter.totals()` (L56)

Returns a shallow copy. `UsageTotals` is entirely flat numbers, so a shallow copy *is* a deep
snapshot — pinned by the last test. Verdict: correct.

## Bugs found

None found.
