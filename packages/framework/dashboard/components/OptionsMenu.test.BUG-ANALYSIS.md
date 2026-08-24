# Bug analysis: packages/framework/dashboard/components/OptionsMenu.test.tsx

## Business logic (high-level)

A thorough suite covering everything its test SPEC lists: the presence dot + hover count (and
no number in the badge), option write-through, disabled rows (greyed, reason in place, click
writes nothing), the flat Run-on list (no legacy header/duplicate row; absent entirely without
`agentTarget`; device half absent without `connection`), Claude web as a real selectable target,
the single checkmark across all four states (driver / device selected / remote daemon / driver
click clears the device), device row semantics (select without navigation or preference, remove
without selecting, offline dimming + annotation, online dot, Add flow), and This-machine's two
meanings (local: write + clear device; remote: go home, no write).

Verification that the tests test what they claim:

- The row-targeting strategy is sound and self-documented: rows are located by tokens that never
  appear in the sub-trigger summary (unique descriptions, the device URL), so the summary echoing
  a label cannot make `getByText` ambiguous — a real hazard they engineered around (the
  `CLAUDE_WEB`-by-description case even explains why).
- `isChecked` inspects the row's *first* svg's `opacity-100` — the Check icon is the first svg in
  both driver and device rows (Check renders before MonitorSmartphone), so the probe reads the
  right element. It would break if the icon order changed, but then it would fail loudly, not
  pass vacuously.
- Negative assertions accompany every positive one where the invariant is "exactly one" (each
  checkmark test asserts at least two unchecked rows; the go-home test asserts `onChange` NOT
  called; the remove test asserts `onSelect` NOT called; the device-click test asserts no
  preference write).
- Async: only the tooltip test is async and it awaits `hoverTooltip`. Everything else is
  synchronous menu interaction — correct for Base UI under fireEvent.
- Hygiene: hoisted `updatePreferences` mock reset in `afterEach`; fresh fixture factories per
  test (`profiles()`, `connectionControl()`), so callback spies never leak across tests;
  `cleanup` closes menus.
- `toHaveBeenCalledWith(profiles()[0])` compares structurally against a fresh fixture — valid
  because vitest uses deep equality.

Coverage gaps (minor, not bugs): `busy` disabling (trigger, sub-trigger, Add row) and the
still-being-checked device state (no status entry → muted dot) are unasserted.

## Functions (low-level)

- `mainOptions()`, `profiles()`, `connectionControl(over)`: minimal, fresh-per-call fixtures.
  Correct.
- `open()` / `openAgentOn()` / `rowOf()` / `isChecked()`: helpers as analysed. Correct.
- Seventeen tests, each falsifiable, each pinned to the issue number it guards. Correct.

## Bugs found

None found.
