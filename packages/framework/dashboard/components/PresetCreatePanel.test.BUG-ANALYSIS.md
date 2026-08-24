# Bug analysis: packages/framework/dashboard/components/PresetCreatePanel.test.tsx

## Business logic (high-level)

Covers exactly what its test SPEC promises: prefill from the composer and a well-formed save
(typed name + prefilled prompt + generated id, and — with no project — the `'user'` scope);
Save disabled until both fields are non-empty; "This project" reports the `'project'` scope
while the default is `'user'`; no scope choice without a project; Cancel calls back.

Verification that the tests test what they claim:

- The save test destructures the actual `onSave` call and asserts label/prompt equality plus a
  truthy id and the forced `'user'` scope — the id is only asserted truthy (not UUID-shaped),
  which is the right looseness given the documented fallback.
- The disabled test asserts the button's `disabled` property directly with an empty prompt AND
  empty name — it does not separately pin "name only" / "prompt only" (both-empty implies the
  guard exists but a regression to `||`→`&&` in only one operand could slip; in practice the
  save-path test covers the name side). Minor coverage nit, recorded below.
- The project-scope test clicks the segmented button before saving; the default-scope claim is
  pinned by test 1's `'user'` (though that one is the no-project path — the with-project default
  is implied by the SPEC, not directly asserted). Another minor nit.
- Cancel asserts `toHaveBeenCalledTimes(1)` — guards double-fire through the Dialog's
  `onOpenChange` path.
- All synchronous (no async surface in the component); no mocks needed beyond spies; `cleanup`
  per test. Nothing un-awaited.

Coverage gaps (not bugs): the Ctrl/Cmd+Enter save chord, Escape-closes-via-dialog, the `busy`
disabling, the 80-char `maxLength`, and the with-project *default* scope are untested here.

## Functions (low-level)

- Five tests, plain arrange/act/assert with `getByPlaceholderText` / `getByRole` queries that are
  unique in the rendered dialog. Correct.
- Type-cast of the mock call tuple (`as [CustomPreset, string]`): fixture-side convenience,
  sound. Correct.

## Bugs found

None found.
