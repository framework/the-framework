The "Devices" section of Settings: the devices [1] saved in this browser, each row showing its label, its URL and whether it is online, with a button to add a device and a button per row to remove it. A device carries its own token, so the roster lives in this browser's storage and never on the daemon, and the section says so.

## Context

**User story**: the user pairs a second machine running The Framework by pasting the URL that machine prints when it starts. From then on the composer's "Run on" list offers that device [1], so the next agent [2] can be relayed [3] to it, and Settings lists the device under "Devices" so the user can see whether it is reachable and drop it when it is gone.

**Problem**: a device is reached with its own token, a per-browser secret; keeping the roster in the daemon's registry would hand that token to every browser the dashboard serves. A settings row is normally assumed to follow the user to their next browser, and this one does not, so the section says so.

## Glossary

[1] device: another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[3] relay: running an agent on a device: the local daemon forwards the start, streams the events back and forwards steering, so the agent renders like a local one.

## Business logic — TL;DR

- **The roster lives in this browser** - devices are read from the browser's own storage, never from the daemon, because each carries its own token; the section's note says so.
- **Each device shows its online state** - every row shows "Online", "Offline" or "Checking…", re-checked through the daemon every 10 seconds; the state disables nothing.
- **Adding a device** - "Add device" opens the add-device dialog; with nothing saved the list reads "No devices saved. Add one with the URL another machine prints when it starts."
- **Removing a device un-targets it** - the row's "Remove <label>" button drops the device at once, and if it was selected as the next agent's target that selection is cleared.

## Business logic

### The roster lives in this browser

#### Context

See `## Context`.

#### Business logic

The section is titled "Devices" and explains itself: "Other machines running The Framework that you can run a session on. Saved in this browser, not on the server, because each one is reached with its own token." The roster is read from this browser's storage (the storage rules in `lib/profiles.ts`), newest first; each row shows the device's [1] label and, under it, its URL. Nothing in this section is a preference: it never reaches the daemon's registry.

### Each device shows its online state

#### Context

**User story**: before relaying [3] an agent [2] to a device [1], the user sees at a glance whether that machine is reachable.

#### Business logic

Each row carries a status dot and a word: "Online", with the dot in the accent color, when the daemon could reach the device with the device's token; "Offline" when it could not; and "Checking…", with a neutral dot, while the first check has not answered. Reachability is asked of the daemon for every saved device that has a token, and asked again every 10 seconds (the rules in `lib/use-device-status.ts`); a saved device without a token is never checked and stays at "Checking…". The state is display only: no control on the page is disabled by it.

### Adding a device

#### Context

See `## Context`.

#### Business logic

The "Add device" button at the top right of the section opens the add-device dialog (its rules in `AddDeviceDialog.tsx`). The dialog closes when it is dismissed or once a device was added, and the new device appears in the list at once. While no device is saved, the list is replaced by "No devices saved. Add one with the URL another machine prints when it starts."

### Removing a device un-targets it

#### Context

**Problem**: the composer lets the user pick a device [1] as the target the next agent [2] is relayed [3] to; a device that is removed must not stay that target, or the next agent would point at something no longer in the list.

#### Business logic

Each row's trash button, named "Remove <label>" and carrying the same tooltip, removes the device from the roster immediately, without a confirmation step. If the removed device is the one currently selected as the next agent's target, that selection is cleared first (the selection rules in `lib/remote-target.ts`), the same guard the composer applies.
