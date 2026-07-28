Root Vike layout: imports the app stylesheet, applies the color-theme preference (#725) by toggling the `.dark` class on `<html>`, and wraps every page in the themed shell plus an ErrorBoundary.

## TLDR

- Theme comes from `usePreferences()` + `themePreference()` (lib/preferences): `system` (default, follow the OS) | `light` | `dark`; an effect toggles `document.documentElement`'s `.dark` class via `resolvedDark(theme, matchMedia('(prefers-color-scheme: dark)').matches)`.
- Subscribes to live OS scheme changes only while on `system`; `light`/`dark` are fixed choices.
- Client-only app (`ssr:false`), so mutating the DOM in an effect is fine; until preferences load over Telefunc the choice is `system`, so a dark-OS user still gets dark first paint.
- The ErrorBoundary (#1194) sits inside the themed `bg-background` wrapper so a caught crash shows its recoverable card on the app's own background rather than the browser's blank white — everything dynamic (live feed, polled panels, markdown) renders below it.
