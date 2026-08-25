# Bug analysis: packages/framework/dashboard/main.tsx

## Business logic (high-level)

The SPA entry (SPEC: starts the app in the daemon-served page; everything else is client-side).
Imports the Tailwind stylesheet, mounts `<AppFrame><App/></AppFrame>` into `#root`, throws a
clear error if `index.html` lacks the root node (a build-integrity failure, better loud than a
blank page).

Deliberate choices verified against intent:
- **No StrictMode** — documented on purpose: the live feed, polls and theme listener mount real
  subscriptions; double-invoking effects in dev would double-subscribe SSE channels and skew the
  arrival-time stamping. Consistent with the hooks' design (their cleanups are correct, so
  StrictMode would work, but the trade-off is stated and coherent).
- **No prerender/hydration** — `createRoot(...).render(...)` matches the plain-Vite,
  static-`index.html` architecture the comments describe (`hydrateRoot` would be wrong here).
- The `?token=`/`?draft=` bootstrap is handled elsewhere (daemon redirect + App), so nothing here
  needs to read the URL.

Edge cases: none of consequence — the module runs once per page load; a second execution cannot
happen (no HMR-sensitive state is held here beyond React's own root, and Vite reloads the page
for entry changes).

## Functions (low-level)

- Module body — get `#root`, throw if missing, render. Verdict: correct.

## Bugs found

None found.
