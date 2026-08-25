# Bug analysis: packages/framework/src/quota-boundary.test.ts

## Business logic (high-level)

Exercises the whole surface with a fixed `NOW` (Monday 2026-07-20 12:00Z) so every expectation is a hand-computable constant:

- **Prose parsing** — both phrasings (`at` / comma), minutes, `12am`/`12pm` → 0/12, named zones on both sides of a DST change (Berlin +2 summer / +1 winter, with exact UTC epochs), year recovery across New Year in both directions, and four refusal cases (`soon`, bad month, `13am`, unknown zone). Each is an exact-epoch `assert.equal`, so an off-by-one-hour zone bug or a wrong-year pick fails loudly.
- **Continuity (#960 Edit)** — percent 0 at the first instant, exactly 25 at 1.75 days (exact in binary floating point: 1.75/7 = 0.25), 50 at 3.5 days; 100 only at the reset instant, and day 7 the day before reset carries only 6/7 — the "no lump on the last day" property that is the feature's whole point.
- **`day`** — 1 at start, still 1 at `start+DAY-1` ms, 2 at exactly `start+DAY` (steps at the week's own second, not midnight), 3 at 2.5 days; a stale, already-reset week reads day 7, not 8.
- **Status** — 16% used under a ~31.5% boundary → `reached: null`; 50% → the account week named as reached. Model windows: Fable's 90% stops Fable work (2 windows in force), does not stop Sonnet (1 window), and with no model only the account week counts.
- **Unknown** — empty windows, week without reset prose, unparseable prose → `undefined`.
- **Limit (#960)** — default offset 0 means limit === boundary; a negative offset pulls the line below what is spent (same reading flips to reached, boundary itself asserted unchanged — the separation the SPEC demands); a positive offset restores room; ±500 clamps to 0/100, and 99% used under a 100 limit still runs.

Do the tests verify what they claim? Yes — all epoch/percent assertions are exact equalities against independently computed constants (not round-tripped through the code under test). The one soft spot: the clamp-low test (`limitOffset: -500` with 0% used) asserts `limit.percent === 0` but deliberately does not assert `reached` — which is the 0>=0 corner where the implementation reports "reached". The suite thus leaves that corner unpinned rather than wrong; the source analysis judges the behavior consistent with the SPEC.

Async: everything synchronous. `weekWindow` helper builds well-typed `DriverQuotaWindow`s; non-null assertions (`!`) are applied only after an `assert.ok(status)` or in tests whose premise guarantees a status. No vacuous or unfalsifiable assertions found.

## Functions (low-level)

- **`weekWindow(percentUsed, resetsAtText?)`** — default `'Jul 25 at 7am (UTC)'`, 5 days after NOW → elapsed 2d5h, boundary ≈ 31.55% — matches the inline comments. Correct.
- **DST tests** — rely on the host having full IANA zone data (Node ships ICU with it). Fine for this repo's test environment.

## Bugs found

None found.
