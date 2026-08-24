# Bug analysis: packages/framework/dashboard/components/GitStatusBar.test.tsx

## Business logic (high-level)

Pins #809's core contract: project home reads `onGitStatus` (and never the worktree RPC), a
session reads `onAgentWorktree` (and never the project RPC), a worktree's extras render (dirty
wording, size "5 MB", PR chip with lowercased state), an unknown size renders nothing (no stray
en dash), and a null status renders an empty bar.

Do the tests verify their claims?

- Call-routing tests assert both the positive call (via awaited `waitFor`) and the negative
  (`not.toHaveBeenCalled()` on the other RPC) — falsifiable in both directions.
- The size-omitted test asserts `container.textContent` lacks `–` (the `formatBytes` default
  fallback) — this pins that the component passes the `''` fallback, which is exactly the
  regression the comment describes.
- The empty test (`textContent === ''`) is strict enough to catch any stray chrome rendered
  without a status.
- Hygiene: mocks cleared per test, every test sets its own `mockResolvedValue` before rendering,
  `cleanup` unmounts and stops the poll interval. All async assertions awaited.

Observations (not bugs, but stale fixtures worth flagging alongside the source bug): the branch
fixtures use the *legacy* `the-framework/dark-mode` naming; current branches are `tf-…`
(`src/branch-names.ts`). The assertions hold regardless (no `label` is passed, so the
prefix-strip path is not exercised), but the fixtures should move to `tf-…` when
`GitStatusBar.tsx` L82's stale strip is fixed — as fixtures stand, the suite cannot catch that
bug because the shortening branch (label + prefix) is never rendered.

Coverage gaps consistent with the file's scope (routing + worktree facts): the label/breadcrumb
layer, the disclosure button, the 1s `prPending` cadence, and `keepPrevious` in-place updates are
untested here.

## Functions (low-level)

- `onGitStatus` / `onAgentWorktree` mocks + `vi.mock('../rpc/reads.js')`: correct
  factory-closure pattern ahead of the dynamic import. Correct.
- Test 1 (project home): also asserts the clean wording. Correct.
- Test 2 (worktree facts): 5 MiB → "5 MB" matches `formatBytes` rounding. Correct.
- Test 3 (PR chip): asserts number and lowercased state; the tooltip title is not asserted (fine).
  Correct.
- Test 4 (size omitted): see above. Correct.
- Test 5 (null → nothing): waits for the call, then asserts emptiness — no race, since the
  resolved null renders synchronously after the awaited `waitFor`'s act flush. Correct.

## Bugs found

None found. (The stale `the-framework/…` fixtures are recorded above and travel with the
`GitStatusBar.tsx` L82 finding; they do not make any current assertion wrong.)
