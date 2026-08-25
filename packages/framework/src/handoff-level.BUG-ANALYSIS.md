# Bug analysis: packages/framework/src/handoff-level.ts

## Business logic (high-level)

The handoff ladder (B5): one ordinal `local < push < pr < merge` replacing three booleans, so impossible combinations ("PR without push") are unrepresentable and ambiguous checkbox answers resolve *downward* (publish less, never more). Node-free leaf so browser surfaces can import it. Checked clause-by-clause against `handoff-level.SPEC.md`:

- Four rungs, each including the ones below — encoded by `HANDOFF_LEVELS` order + `handoffReaches` index comparison. Matches.
- Default `pr` — `DEFAULT_HANDOFF = 'pr'`. Matches ("merge has to be asked for").
- The three stage questions always agree — `handoffStages` derives all three from the one rung. Matches.
- Impossible checkboxes resolve downward — `handoffFromStages` returns the highest rung fully ticked from the bottom: `{pr: true, push: false}` → `local`; `{push: true, merge: true, pr: false}` → `push`. Both err toward publishing less, exactly the SPEC's rule. Matches.

Round-trip property (probed mentally for all four rungs): `handoffFromStages(handoffStages(level)) === level` — local `{f,f,f}`→local; push `{t,f,f}`→push; pr `{t,t,f}`→pr; merge `{t,t,t}`→merge. Holds.

Edge cases: `handoffFromStages` takes optional booleans; `undefined` is falsy so a missing box reads as unticked — the conservative direction, consistent with the events SPEC's "absent reads as off". `isHandoffLevel` correctly rejects non-strings, near-misses (`'PR'` — case-sensitive, correct for a persisted enum), and `undefined`. `handoffReaches` relies on both arguments being valid `HandoffLevel`s (typed); a corrupted persisted value would first pass through `isHandoffLevel` at parse boundaries (its stated purpose), so `indexOf` never sees -1 in practice — and even if it did, `-1 >= -1` for two invalid values is the only odd case, unreachable through the typed API.

## Functions (low-level)

- **`HANDOFF_LEVELS`** — ladder order, lowest first; the single source of ordering. Correct.
- **`DEFAULT_HANDOFF`** — `'pr'`, per #1102 zero-config rationale. Correct.
- **`isHandoffLevel(value)`** — type guard via `includes` on the widened readonly array. Correct.
- **`handoffReaches(level, rung)`** — `indexOf(level) >= indexOf(rung)`. Reflexive (a rung reaches itself), transitive by index order. Correct.
- **`handoffStages(level)`** — three derived booleans; cannot disagree with each other by construction. Correct.
- **`handoffFromStages(stages)`** — bottom-up gate chain; verified truth table over all 8 input combinations: `fff`→local, `ffm`→local, `fpf`→local, `fpm`→local (push unticked dominates), `tff`→push, `tfm`→push (merge without pr drops to push), `ttf`→pr, `ttm`→merge. Every row is the highest fully-ticked-from-bottom rung. Correct.

## Bugs found

None found.
