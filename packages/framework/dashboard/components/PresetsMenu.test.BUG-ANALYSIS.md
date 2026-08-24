# Bug analysis: packages/framework/dashboard/components/PresetsMenu.test.tsx

## Business logic (high-level)

Pins the PresetsMenu behaviors named in its test SPEC: built-ins listed and loaded via `render()`
output; user and project custom presets load their stored prompt verbatim; delete controls delete
without loading, with project presets routed to `onDeleteProject` (not `onDelete`); the "Project
presets" group hidden when empty; "New preset…" opens the create panel and is absent when `onNew`
is undefined.

The harness (`mount`) renders with two built-ins (one with tooltip, one without — so both render
paths in the component are exercised), one user preset, one project preset, then opens the menu by
clicking the trigger (`getByRole('button', { name: /presets/i })` — the trigger's aria-label).
All assertions run against the opened menu. `afterEach(cleanup)` prevents cross-test DOM leakage.

Coverage gaps (not bugs, noted for completeness): the `newAgent` forwarding for a built-in marked
`newAgent: true` is only pinned indirectly (the first test asserts the third arg is `undefined`
for an unmarked preset — so the arity/forwarding is exercised, but no test asserts `true` is
passed through); tooltip content ("Plan it") is never asserted; `busy` disabling is untested.
These behaviors are covered by the component's simplicity and the composer-side tests.

## Functions (low-level)

### `mount(over)`

Renders PresetsMenu with default fixture props merged with `over`, clicks the trigger to open the
menu, returns the four spies. Edge cases:

- `over` can inject `onNew: undefined` — spread after defaults, so the explicit `undefined`
  overrides the spy; the "no create item" test depends on exactly this and it works (object spread
  keeps explicitly-undefined keys).
- Opening via `fireEvent.click` on a Base UI menu trigger: Base UI opens on click in jsdom; every
  test then finds menu content, so if opening ever broke, all tests fail loudly rather than pass
  vacuously.
- The name regex `/presets/i` could match other buttons if fixtures added one, but the only
  button rendered before opening is the trigger. Correct.

### Individual tests

- "lists built-ins and loads the rendered prompt": clicks `[Research]`, asserts
  `onLoad('RESEARCH PROMPT', '[Research]', undefined)` — verifies `render()` is called and the
  third (`newAgent`) arg is forwarded as-is. Can fail if loading breaks. Correct.
- "a saved preset loads verbatim": asserts two-arg call `('sweep it', 'My sweep')` —
  `toHaveBeenCalledWith` with two args fails if a third non-undefined arg were passed, so it also
  pins that saved presets never get `newAgent`. Correct.
- "the delete button deletes without loading": asserts `onDelete('c1')` and `onLoad` not called —
  pins the stopPropagation behavior. Correct.
- Project-preset load/delete tests mirror the user-preset ones and additionally assert the user
  handler is NOT called for a project row — pins the handler routing (#1025). Correct.
- "Project presets group hidden": `queryByText('Project presets')` null with empty list. Correct.
- "New preset… opens the create panel" / "no create item where no panel exists": both assert on
  the literal item text. Correct.

All interactions are synchronous (`fireEvent` + immediate `expect`); nothing async goes unawaited.
No test can pass vacuously: each clicks a real element found by query (throws if missing).

## Bugs found

None found.
