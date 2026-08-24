# Bug analysis: packages/framework/dashboard/components/WorkspaceActions.test.tsx

## Business logic (high-level)

Tests for the shared checkout-actions bar. Two suites:

- **#809 (shared bar)** — a session render passes `('p1','files','run-1')` / `('p1','editor','run-1')`
  through `sendOpenInApp` (worktree addressing — the suite's core claim); the project render passes
  `undefined`; and both pages offer the same number of buttons (after waiting for the GitHub link
  in each, so the counts compare like with like). All genuine, args pinned exactly.
- **#727 (editor picker)** — picking a detected editor stores its bin; picking Default stores `''`;
  a stored-but-undetected editor renders as its own row (asserted by its bin text appearing).

Mock setup: whole-module mocks for reads/control/preferences/editors, with `prefs` and
`detectedEditors` as mutable holders reset in `beforeEach`. Sound pattern.

Staleness (mirrors the source file's own drift, harmless to correctness): the control-module mock
still stubs `sendPreview`/`onServeTargets`/`onPreviewStatus`/`sendStopPreview` and the reads mock
`onAgentWorktree` — none exist in the real `rpc/control.ts`/component imports anymore (the Serve
feature was removed), and the `buttons()` helper's comment still says "folder, editor, serve".
Extra mock exports are inert and the position-based `buttons()[0]` (folder) remains correct with
the real button set (folder, editor), so no assertion is wrong — but the comment misdescribes the
DOM it indexes.

Coverage gaps (noted, not bugs): the error-surfacing and reset-on-switch behaviors
(`Failed to open.` / clearing on project/agent change) are untested, as is the GitHub-less render
(no `onGithubUrl → null` case); the picker's check-mark position and `closeOnClick` behavior are
unasserted. What is asserted verifies what it claims.

## Functions (low-level)

- **`renderActions(agentId?)`** — fixed `projectId="p1"`. Correct.
- **`buttons()`** — `getAllByRole('button')`; index 0 is the folder button because the GitHub
  element is an anchor (role link) — verified against the component's render order. Position-based
  but stable. Correct.
- **`openEditorMenu()`** — by accessible name from the trigger's `aria-label`. Correct.
- **Editor-picker assertions** — `getByText('Cursor')`/`getByText('Default')` click the menu rows;
  `updatePreferences` args pinned. The custom-row test uses `getAllByText('mate')` (label and
  description both render the bin) with a `>0` length check — loose but sufficient to prove the
  row exists. Correct.
- `beforeEach` resets the three mutated mocks and both holders; `sendOpenInApp` cleared so the
  cross-call `toHaveBeenCalledWith` assertions cannot bleed between tests. Correct.

## Bugs found

None found.
