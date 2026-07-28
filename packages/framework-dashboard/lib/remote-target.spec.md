In-memory store of which saved device is selected as this browser's run target (#1067), exposed via `useSyncExternalStore`.

## TLDR

- Module-level `selectedDeviceId` (the device's profile id = its origin URL) + listener set; `selectRemoteDevice(id|null)` writes, `getSelectedRemoteDeviceId()` reads at submit time, `useSelectedRemoteDeviceId()` is the reactive view.
- `null` means a driver target (this machine / GitHub Actions) is selected.

## Decisions

- Deliberately ephemeral, never persisted in Preferences: a device's token is a per-browser secret, so the run target is transient UI state, unlike `local`/`actions`.
- Node-free leaf (like `profiles.ts`) so nothing Node leaks into the SPA bundle.
- Server snapshot for `useSyncExternalStore` is always `null`.
