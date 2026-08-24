# Bug analysis: packages/framework/dashboard/components/ContextFiles.test.tsx

## Business logic (high-level)

Pins the three behaviors of the (fully presentational) ContextFiles: nothing for an empty list,
each file listed by path, and removal reporting the full path. Matches `ContextFiles.test.SPEC.md`
territory exactly. All-synchronous component, so the synchronous tests are appropriate;
`afterEach(cleanup)` present; the removal test uses the accessible name (`Remove DECISIONS\.md`),
which also pins the aria-label contract.

Coverage gap (not a bug): `busy` disabling the X buttons is untested.

## Functions (low-level)

- "renders nothing when there are no files" (L8): `container.firstChild` null — exact. Correct.
- "lists each file by its path" (L13): two paths, including a nested one. Correct.
- "removing a chip reports the full path" (L19): role+name query, asserts the callback argument.
  Falsifiable (e.g. would catch passing an index or basename). Correct.

## Bugs found

None found.
