# Bug analysis: packages/framework/dashboard/components/ThemeToggle.test.tsx

## Business logic (high-level)

Three tests pinning #754: the theme is reachable from the header and writes the shared preference.
The `lib/preferences.js` module is fully mocked (avoids a fetch behind a component test);
`themePreference` is restated as `p.theme ?? 'system'` — verified identical to the real
implementation (`lib/preferences.ts:313-315`), so the restatement cannot mask drift unless the real
helper changes, which its own tests cover.

- **"picking a theme persists it"** — opens the menu, clicks Dark, asserts
  `updatePreferences({ theme: 'dark' })`. Genuine: fails if the write or the menu wiring breaks.
  It clicks by visible text ('Dark'), so it also pins the label.
- **"the trigger shows the current theme"** — uses the shared `hoverTooltip` helper (retries the
  hover pair inside `waitFor`, #1398-hardened) and asserts the tooltip text exactly
  (`'Theme: Dark'`). Correct.
- **"an unset preference reads as system"** — empty preferences → tooltip `'Theme: System'`.
  Pins the default. Correct.

Hygiene: `cleanup` + `updatePreferences.mockReset()` per test; `usePreferences` is re-armed with
`mockReturnValue` in each test so not resetting it is harmless. The dropdown item click works
without user-event pointer plumbing because the ui DropdownMenuItem handles plain click events
(same pattern as the other menu tests in this suite).

Not covered (acceptable): the check-mark position inside the open menu, and `closeOnClick={false}`
(menu staying open). Neither is a spec-level behavior; their absence does not weaken the pinned
claims.

## Functions (low-level)

- **`open()`** — clicks the trigger by role+accessible name (`aria-label="Theme"`). Correct.
- **Module mock** — exports the three names the component imports; no `ThemePreference` type export
  needed at runtime. Correct.
- Each test arms `usePreferences` before render — no cross-test leakage of return values (each call
  overrides the previous `mockReturnValue`).

## Bugs found

None found.
