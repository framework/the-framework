# Bug analysis: packages/framework/dashboard/components/ThemeToggle.tsx

## Business logic (high-level)

The header's appearance control (#754): a dropdown over the one `preferences.theme` setting (#725)
that the rest of the app (LayoutDefault) resolves onto `<html>`. Responsibilities: show the current
choice on the trigger (icon + tooltip), list the three options with a check on the active one, and
write the pick through `updatePreferences` — a second surface onto one setting, never a second
setting (no local state, so it cannot drift from the gear/Settings page).

Edge cases considered:

- Unset preference → `themePreference` yields `'system'`; trigger shows Monitor. Correct default.
- Junk stored theme cannot reach here: the registry constrains `theme` to the known set on load
  (`registry.ts:366-369`), so `THEME_OPTIONS.find(...) ?? THEME_OPTIONS[0]` is a type-level safety
  net, not a live path (reliance noted; the fallback is sane anyway — reads as System).
- `closeOnClick={false}` keeps the menu open so the palette change is visible under the pick —
  matches the comment's intent; re-render moves the check mark because `usePreferences` is reactive.
- Repeated pick of the same value just rewrites the same preference — idempotent, harmless.
- No cleanup concerns: no effects, no subscriptions of its own.

## Functions (low-level)

- **`THEME_OPTIONS`** — three entries in trigger order, `system` first; values match the registry's
  `KNOWN_THEMES` union exactly. Correct.
- **`ThemeToggle()`** — reads preferences reactively; `current` lookup with non-null fallback;
  renders trigger (aria-label "Theme", tooltip "Theme: <label>") and the three items. The check-mark
  visibility compares `t.value === theme` against the resolved preference (not `current.value`), so
  even the impossible junk-theme state would show no check rather than a wrong one. Writes
  `updatePreferences({ theme: t.value })` — exactly the preference LayoutDefault reads. Correct.

## Bugs found

None found.
