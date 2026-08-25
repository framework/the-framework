# Bug analysis: packages/framework/dashboard/lib/draft-handoff.test.ts

## Business logic (high-level)

Round-trips the real jsdom sessionStorage/location/history (no mocks — the header comment makes
that the point): the `?draft=` param lands in storage under the exact key and leaves the URL
while other params stay; the take is read-once; no param is a no-op that leaves the URL alone.

Do the tests verify what they claim?

- Test 1 seeds the URL with an *encoded* draft plus a bystander param, asserts the decoded value
  in storage (pinning that URLSearchParams decoding happens) and `location.search === '?keep=1'`
  (pinning both the strip and the preservation). Sound.
- Test 2 pins take-then-null — the read-once guarantee. Sound.
- Test 3 pins the no-op path including URL untouched. Sound.
- Hygiene: `afterEach` clears storage and resets the URL, so ordering cannot leak state between
  tests. Assertions are exact (`toBe`), nothing vacuous.

Not covered (noted): `stashPendingDraft` (the in-app #1139 producer — one storage write; its
consumer path is exercised via test 2's takePendingDraft anyway), the hash surviving the strip,
and the storage-unavailable fallback (hard to simulate meaningfully in jsdom). Minor gaps, not
defects.

## Functions (low-level)

- No helpers; direct history/storage manipulation per test. Correct.

## Bugs found

None found.
