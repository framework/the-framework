# Bug analysis: packages/framework/dashboard/components/DevicesSettings.tsx

## Business logic (high-level)

Settings section for the saved-devices roster (#1052/#1072). Responsibilities: list the
localStorage-backed connection profiles with label + origin and a live online/offline badge
(polled via `useDeviceStatus`), add via `AddDeviceDialog`, remove with the same guard the
composer applies — removing the device currently selected as the run target clears that selection
(otherwise the next agent would target something no longer in the list). The header copy states
the per-browser (token-carrying, never-on-daemon) nature of the entries, matching `profiles.ts`'s
design.

Invariants checked:

- `remove` clears the selection first, then removes — order matters only cosmetically (both are
  synchronous, subscribers re-render once each); no window where a phantom selection persists.
- Empty state names the way in ("Add one with the URL another machine prints…").
- Rows keyed by `profile.id` (the origin — unique by `addProfile`'s dedupe).
- Status badge three-state: undefined → "Checking…" (first ping still out), else Online/Offline.
  Matches its doc comment. (Cosmetic note: online dot uses `--color-primary` here while
  ConnectionIndicator's dot uses `bg-success` — an inconsistency of hue, not behavior.)
- Dialog open/close local state; `onAdded` also closes. No leak: the poll lifecycle lives in
  `useDeviceStatus` (lib).

## Functions (low-level)

### `DevicesSettings()` (L24–91)

State: `adding` only. `remove(profile)`: conditional `selectRemoteDevice(null)` +
`removeProfile(id)` — correct and test-pinned in both directions (targeted vs other device).
Accessible names `Remove {label}` on the real buttons. Verdict: correct.

### `DeviceStatusBadge({ state })` (L94–108)

Pure mapping; dot colored only for online, gray otherwise (including "Checking…" — reasonable,
does not claim offline in words while unknown). Verdict: correct.

## Bugs found

None found.
