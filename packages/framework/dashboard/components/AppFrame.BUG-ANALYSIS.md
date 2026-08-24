# Bug analysis: packages/framework/dashboard/components/AppFrame.tsx

## Business logic (high-level)

The outermost shell: applies the theme class and wraps everything in the error boundary.
Checked against `AppFrame.SPEC.md`:

- **Three choices** — `themePreference(usePreferences())` yields `system | light | dark`;
  absent preference (including before the daemon answers — `usePreferences` serves `{}` until
  loaded) resolves to `system`, giving a dark-OS user a dark first paint. ✓
- **OS followed only while chosen** — the effect always applies once
  (`root.classList.toggle('dark', resolvedDark(theme, mql.matches))`), then subscribes to the
  `prefers-color-scheme` MediaQueryList *only* when `theme === 'system'`; light/dark return
  early with no listener, so they are fixed. Listener removed on cleanup, and the effect
  re-runs on every theme change (dep `[theme]`), so switching system→dark unsubscribes and
  dark→system resubscribes. No leak, no stale-theme capture (`apply` closes over the current
  `theme`). ✓
- **Crash lands on the app's background** — `ErrorBoundary` sits *inside* the
  `bg-background text-foreground` div, which itself is inside the themed `<html>` class the
  effect sets, so the recovery card renders on the app's palette. ✓ (The boundary cannot catch
  a crash in AppFrame's own render, but that render is a static div — nothing to crash.)

Edge cases: `resolvedDark` truth table is exactly the SPEC's (dark → true; system → OS; light
→ false); repeated `apply()` calls are idempotent (`classList.toggle` with force flag);
`matchMedia` exists in every supported browser and in jsdom used by the suites. The
preferences store re-renders this component via `useSyncExternalStore` when the daemon's
answer lands, re-running the effect with the real theme — the "until the preferences have
arrived" transition the SPEC describes.

## Functions (low-level)

- **`AppFrame({ children })` (L8)** — one effect, analyzed above; returns the themed wrapper +
  boundary. Inputs: children; side effect: the `dark` class on `document.documentElement`.
  Verdict: correct.

## Bugs found

None found.
