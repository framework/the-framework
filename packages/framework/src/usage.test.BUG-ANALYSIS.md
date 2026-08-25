# Bug analysis: packages/framework/src/usage.test.ts

## Business logic (high-level)

Five synchronous tests over `UsageMeter`. They pin the two things that matter about this class: the
arithmetic (every field sums, turns count) and #540's absent-vs-zero cost rule.

The suite is careful in one specific way that is easy to get wrong: it asserts
`assert.equal('costUsd' in totals, false)` rather than only `totals.costUsd === undefined`. Those
differ — an implementation that assigned `costUsd: undefined` would pass the `=== undefined` check
and fail the `in` check — and the `in` form is the one that matches the module's conditional-spread
implementation and its JSON-serialization intent. Test L34 asserts *both*, which is the right
belt-and-braces for the rule the whole module exists for.

What is pinned:

- **Zero state** — the full object via `deepEqual` (so a stray `costUsd: 0` fails) plus the `in`
  check.
- **Summation** — two identical turns, asserted with `deepEqual` on all six fields at once.
- **Unpriced runs** — Codex's real shape (counts, no `costUsd`), asserted to total tokens while
  leaving the cost absent.
- **Mixed runs** — one unpriced turn then one priced turn; the cost equals only the priced turn's,
  and the turn count is 2. The comment is honest that mixed drivers do not occur today, and the
  test still fixes the meaning of "what we know was spent".
- **Snapshot semantics** — a snapshot taken between two `add`s does not move.

All tests are synchronous, so no await hazard. Each builds its own meter, so there is no shared
state or ordering dependency.

## Functions (low-level)

### `turn` fixture (L5)

One priced turn with distinct values per field (100/40/900/50), so a field mixed up in `add` shows
up as a wrong number rather than as a coincidentally equal one. Good fixture design.

### L7 — zero state

`deepEqual` on the whole object. The `deepEqual` alone would already catch a `costUsd: 0`
regression; the added `in` check catches `costUsd: undefined`. Correct.

### L20 — summation

`deepEqual` on all six totals after two adds. `costUsd: 0.04` is exact in IEEE-754 (doubling a
double is exact), so this assertion is not floating-point-fragile. Correct.

### L34 — unpriced

Uses realistic Codex numbers. Asserts turns, two token sums, and both forms of the cost-absence
check. Correct.

### L48 — mixed

The one test that distinguishes "leave the cost alone" from "drop the priced turns". Correct.

### L58 — snapshot

Adds, snapshots, adds again, and asserts the snapshot did not move while the live totals did. This
is what pins `totals()` returning a copy rather than the internal object. Correct.

## Coverage gaps (not bugs)

- Nothing covers a turn reporting an explicit `costUsd: 0` (which would materialize the key with a
  zero total). No driver emits that shape, so it is unpinned rather than untested-and-risky.

## Bugs found

None found.
