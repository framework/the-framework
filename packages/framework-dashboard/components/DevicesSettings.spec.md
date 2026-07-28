Saved devices as a settings section (#1052/#1072): list, add, and remove the other daemons this browser can run sessions on.

## TLDR

- Exists because add/remove previously lived only in the composer's "Run on" menu, which exists only on a project launcher — from the Overview or settings there was no way to manage the roster. The picker still lists devices (choosing a run target is per-run); which devices exist is configuration, so it belongs here.
- Rows show label, origin URL, an Online/Offline/Checking… badge from `useDeviceStatus`, and a remove button; Add opens `AddDeviceDialog`.
- Removing the device a run is targeting also clears the run target (`selectRemoteDevice(null)`) — the same guard the composer applies (#1072), or the next run points at something no longer listed.

## Decisions

- These are NOT preferences: a device carries a token, so profiles live in this browser's localStorage and never reach the daemon (`lib/profiles.ts`). The card copy says so, because the reasonable assumption for a settings row is that it follows you to the next browser.
