# Bug analysis: packages/framework/src/cloud-run-state.test.ts

## Business logic (high-level)

Pins every clause of the `cloud-run-state.SPEC.md` rule with a fixed clock (`NOW`), so nothing is
time-of-day dependent:

- the age rule with its exact boundary: one hour old → `in-cloud`; exactly
  `CLOUD_SESSION_WINDOW_MS` old → `in-cloud` (inclusive); one millisecond past → `done`; an
  unparseable `startedAt` → `done` (the "in cloud forever" lie the rule exists to end);
- `waiting` outranks a PR and outranks age (a 3×-window-old parked session still reads waiting);
- adopted work: PR → `done`, PR+`merged` → `merged` (also over age), PR+`withheld` → `done`;
- the gate: `local`/`actions` targets and `running`/`stopped`/`failed` statuses all yield
  `undefined` — including the interesting `failed + cloudWaiting` combination, pinning that the
  gate runs before the waiting check;
- `cloudRunActive` truth table over all five inputs including `undefined`.

The assertions are exact equalities against literal state words, so no test can pass vacuously,
and each maps to a distinct branch of the implementation — the suite fails if any branch's order
or boundary changes. The fixture builds a fully-settled web run and overrides per case, which
keeps each test about exactly one fact.

Edge cases the suite deliberately leaves to the implementation: a future `startedAt` (clock skew
→ `in-cloud`, harmless direction) and non-`merged` `mergeOutcome` values other than `withheld`
(`auto-armed`, `watched`, `failed` — all fall to the PR check identically to `withheld`). Neither
gap hides a wrong behavior.

## Functions (low-level)

- **`NOW` / `HOUR`** — fixed clock and unit; `Date.parse` of an ISO literal is exact. Correct.
- **`web(over)`** — a `CloudRunFacts` factory defaulting to `target: 'web'`, `status: 'done'`,
  started an hour ago; spread override order puts the test's facts last. Correct.
- **test "a young web run ... past the session window it is done"** — covers both boundary sides
  (`- CLOUD_SESSION_WINDOW_MS` inclusive, `- CLOUD_SESSION_WINDOW_MS - 1` exclusive) and the
  NaN start. Millisecond ISO round-trip through `toISOString`/`Date.parse` is lossless, so the
  boundary assertions are exact. Correct.
- **test "a question the bridge holds ..."** — waiting over default, over PR, over 3× window age.
  Correct.
- **test "adopted work ..."** — done-with-PR, merged, merged-over-age, withheld→done. Correct.
- **test "only a web run whose local half is over ..."** — the five undefined gates. Correct.
- **test "in cloud and waiting count as an agent at work"** — full truth table for
  `cloudRunActive`, iterating the settled states plus `undefined` with `as const`. Correct.

## Bugs found

None found.
