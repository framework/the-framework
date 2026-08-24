# Bug analysis: packages/framework/dashboard/components/ProjectErrorBanner.test.tsx

## Business logic (high-level)

Pins the banner's two SPEC behaviors: no banner at all for a project without errors (both the
`undefined` and `[]` inputs), and a data-sync error announced as an alert carrying the headline,
the emitter's message word for word, and the age ("since 3h ago"). No mocking — the component is
pure, so the test renders it directly with a fixture whose `since` is computed 3 hours before
`Date.now()` at module load.

Verification quality:

- Test 1 renders twice in one test (undefined then `[]`) without an intermediate cleanup; the
  second `render` mounts a fresh container while the first stays in the document, but both render
  nothing, so `screen.queryByRole('alert')` over the whole body correctly proves neither produced
  an alert. The first assertion (`container.textContent === ''`) checks the `undefined` case in
  isolation. Sound.
- Test 2's age assertion: fixture built at module evaluation, rendered milliseconds later —
  `formatAge` floors, so the delta stays "3h ago" (it would take the test an hour to drift to
  "4h ago"); not flaky in practice. Asserting via `alert.textContent` includes the separator text,
  so "since 3h ago" pins both the label and the formatted age.
- All queries throw or the expectations fail on regression — no vacuous passes. Everything is
  synchronous; nothing async to await.

Not covered (noted): multiple simultaneous errors (only one error code exists today, so a
multi-error banner is not a state the daemon produces).

## Functions (low-level)

### `DATA_SYNC` fixture

A realistic `ProjectError`: code `data-sync`, an actual git failure message, ISO `since` 3h back.
Matches the `ProjectError` type (import is type-checked). Correct.

### Test "a project with no errors gets no banner at all"

Covers both empty-input shapes. Correct.

### Test "a data-sync error reads as an alert…"

`getByRole('alert')` pins the announcement semantics; three `toContain` checks pin headline,
verbatim message, and age. Correct.

## Bugs found

None found.
