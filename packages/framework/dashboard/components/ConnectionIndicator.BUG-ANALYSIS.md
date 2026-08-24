# Bug analysis: packages/framework/dashboard/components/ConnectionIndicator.tsx

## Business logic (high-level)

The "connected to" badge (#1052): derives the connection from `window.location.origin` (loopback →
"Local", muted, hidden on narrow screens; anything else → the saved device's label, accented,
always visible), shows an online dot (trivially on for Local, poll-driven for devices, #1072), and
at SPA boot remembers the loopback origin (`rememberLocalOrigin`, a no-op off loopback) and pulls a
carried draft out of the URL (`stashDraftFromUrl`) before the user sees it in the address bar.

Checked against `ConnectionIndicator.SPEC.md`:

- Origin-is-the-connection: `currentConnection(profiles, origin, hostname)` decides label/isLocal.
  Correct per lib contract.
- Boot effect: runs once; `stashDraftFromUrl` is idempotent (Composer calls it again later —
  deliberate, race-safe). Correct.
- SSR guards: effect bails and render returns null without `window` — the dashboard is a pure SPA
  so this is belt-and-braces; harmless.
- Dot: `isLocal || deviceStatus[profiles.find(p => p.url === origin)?.id ?? ''] === 'online'`.
  Profile ids ARE origins (`addProfile` sets `id: input.url` with url normalized to
  `new URL(...).origin`), so the url→id lookup is consistent with `useDeviceStatus`'s keys.
  Edge cases:
  - Before the first status poll answers, a device's status is undefined → dot renders gray for a
    beat even though the page is being served by that very daemon. Transient (one poll), and the
    SPEC ties the dot to the reachability poll — acceptable.
  - Viewing a daemon that is NOT in this browser's saved profiles (e.g. a bookmarked device URL in
    a fresh browser) → lookup fails → dot permanently gray while demonstrably connected. Off the
    sanctioned hop path (profiles are how you hop, and the #1051 bootstrap flow saves one), so a
    noted oddity, not reported.

## Functions (low-level)

### `ConnectionIndicator()`

- `useConnectionProfiles()` + `useDeviceStatus(profiles)`: shared hooks; polling lifecycle lives
  in the lib (not this file's concern).
- Boot `useEffect` (L18–22): see above. Correct.
- Render: two class variants (muted+`hidden sm:inline-flex` local vs accent always-visible
  device) — matches SPEC's "a device never looks like Local"; label truncated at 10rem with
  `truncate`; tooltip copy differs local/device per SPEC. `aria-hidden` on the decorative dot and
  icon. Verdict: correct.

## Bugs found

None found.
