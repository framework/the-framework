# Bug analysis: packages/framework/dashboard/components/ContextMenu.test.tsx

## Business logic (high-level)

Pins the ContextMenu dropdown (#1046): checked-state projection (`aria-checked` true for a path in
the Set, false otherwise), toggle reporting the repo *path* (not id/name), the summary riding the
trigger, the Files list with removal reporting the file path, and the empty-Files hint. Matches
its test SPEC.

Harness: the `open()` helper renders with defaults and clicks the trigger — the dropdown-menu
primitive renders its content on open in jsdom, and the role queries (`menuitemcheckbox`) prove
the menu actually opened, so the helper cannot silently no-op. All interactions are synchronous
(no async state in the component); `afterEach(cleanup)` present.

Coverage gaps (not bugs): `busy` disabling; the "No other repos to add." empty branch; tooltip
content (path-on-hover).

## Functions (low-level)

- "lists the other repos and reflects which are already in context" (L30): aria-checked
  true/false per Set membership. Falsifiable (keying checked by id or name would fail). Correct.
- "toggling a repo reports its path" (L38): asserts the exact path `/w/ui`. Correct.
- "the trigger carries the summary" (L44): renders with a non-empty summary and asserts the
  trigger text. Correct.
- "shows picked files, removable, and the empty hint otherwise" (L52): despite the name, only
  covers the picked-files half (the empty hint is the next test) — the removal assert pins that
  ContextFiles' `onRemove` is wired to `onToggle` with the path. Correct.
- "empty Files hint when nothing is picked" (L60): asserts the hint text. Correct.

## Bugs found

None found.
