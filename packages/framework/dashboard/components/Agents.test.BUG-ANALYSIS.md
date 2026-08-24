# Bug analysis: packages/framework/dashboard/components/Agents.test.tsx

## Business logic (high-level)

Six synchronous tests, no mocks needed (the card is props-only). Coverage matches
`Agents.test.SPEC.md` bullet for bullet:

1. Lists working agents with the "Agents currently working" description; asserts the retired
   "Current"/"Recent" split is gone (guards the #1190 deletion). ✓
2. Click → `onSelectAgent('p1','r1')` — pins the #1189 regression (project *and* agent id; a
   project-only call would fail `toHaveBeenCalledWith`). ✓
3. Empty + not loading → "No agents working right now." ✓
4. Loading → "Loading…" and *not* the empty message — the negative assertion is the point
   ("loading is not the same as empty"). ✓
5. Whitespace intent + sessionName → label falls back to the session name (pins the `.trim()`
   in `activeLabel`; a plain `||` without trim would fail this test). ✓
6. Host chip: one row with `host`, one without → exactly one `/^from /` match — asserts both
   presence and absence in a single regex count, which cannot pass if the chip rendered
   unconditionally. ✓

All interactions are synchronous `fireEvent` + immediate assertions on a props-only component —
no async gaps to mis-await. `cleanup` per test. The fixture builds a type-complete
`ActiveAgent` (verified against `src/dashboard/overview.ts`), so the tests exercise the real
shapes.

Gaps (not claimed by the test SPEC, noted only): the cloud chip ("in cloud"/"waiting") and the
age tooltip (`formatAge`/`formatDateTime` hover) are untested here; the fallback chain's later
rungs (`scope`, `projectName`) likewise. None hides a source defect I could find.

## Functions (low-level)

- **`active(agentId, over)` (L16)** — complete, coherent fixture (`status: 'running'`,
  ISO `updatedAt`, per-run cwd); overrides merge last. Correct.
- **Assertions** — text queries are exact or anchored (`/^from /`), so substrings cannot
  false-positive; `getAllByText(...).toHaveLength(1)` is the right cardinality tool for
  test 6. Correct.

## Bugs found

None found.
