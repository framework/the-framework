# Bug analysis: packages/framework/src/fake-script.test.ts

## Business logic (high-level)

Pins the shape of the scripted demo runs by *parsing them with the real gate parser* (`parseAwaitGate` from turn-gate.ts) rather than string-matching — so the coupling between the fake script's embedded JSON and the parser is genuinely exercised:

- Default run: exactly one turn, no turn carries a gate (`every(... === undefined)`) — falsifiable and matches #1372.
- `choices`: two turns; turn 0 parses to a gate whose recommended resolves to `opt:0` (this pins the label→id resolution in the parser as well) and whose options include "Session cookies"; turn 1 has no gate. All assertions are concrete.
- `multiselect`: two turns; `multi === true`; the pre-checked defaults are exactly `['auth model', 'orders schema']` (order-sensitive `deepEqual` — pins both membership and order).
- Unknown mode: `deepEqual(demoTurns('bogus'), demoTurns(undefined))` — structural equality, which passes for any two runs with equal content; it happens both return the same array instance, but the assertion is still meaningful (it would fail if 'bogus' produced a gate run).

All tests are synchronous; `assert.ok(gate)` before dereferencing prevents a misleading TypeError; non-null `turns[0]!` is safe after the length assertion. No test can vacuously pass.

Coverage gap (recorded, not a bug): the `confirmation` variant (`FRAMEWORK_FAKE_AWAIT=confirmation`, with its `file` pointer and `stop: true` Decline) is not parsed by any test here, so a malformed JSON blob in `AWAIT_CONFIRMATION_TURN` would not be caught by this suite.

## Functions (low-level)

Only inline test bodies:

- **default test** — length + no-gate scan. Correct.
- **choices test (#337)** — gate parse, recommended id, label regex, resume-has-no-gate. Correct; the `recommended: 'opt:0'` assertion is the strongest one in the file because it verifies the parser synthesized ids for id-less options and matched the label-form `recommended`.
- **multiselect test (#339)** — gate parse, `multi` flag, defaults extraction. Correct.
- **unknown-mode test** — fallback equality. Correct.

## Bugs found

None found.
