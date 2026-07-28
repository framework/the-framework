The "Options" gear dropdown (#314/#654): global run-option checkboxes that write preferences straight through, plus the single-select "Run on" submenu covering driver targets and saved devices.

## TLDR

- `options`/`ecoOptions` are `OptionRow`s (the table lives in `lib/run-option-rows.js`; the type is re-exported here so existing importers don't care where it moved, #958); each checkbox writes `updatePreferences({[key]: checked})`; the menu stays open so several can flip at once; Eco's sub-rows render indented when `showEco`.
- Trigger shows a presence dot when any enabled option is checked (#1046) — the count moved into the tooltip ("<label> — N on"); the number badge was noise.
- `RunTarget = 'local' | 'actions' | 'web'` (#1050/#610): this machine, a fresh GitHub Actions runner, or a hand-off to a Claude Code cloud session ("Claude web" is described as the hand-off it is — the session runs on claude.ai and opens its own PR, no streamed run promised).
- `ConnectionControl` (#1052/#1066/#1067): saved remote daemons rendered inside the same "Run on" sub as one flat list — the three driver rows, then device rows, then "Add a device…" — with a single checkmark; no "A device I have" header, no redundant "Local" row.
- Device rows: reachability `StatusDot` (#1072, green online / muted offline-or-unknown), offline rows muted with "(offline)" appended to the URL, and an X that removes via `stopPropagation` without selecting.
- `label` defaults to "Session options"; in-session composers pass no run options and say "Preferences" instead (#833). `runTarget`/`connection` are omitted in-session, where the target is baked in at spawn.

## Decisions

- Selecting a device is ephemeral UI state (the checkmark follows `selectedDeviceId`), not a persisted preference and not navigation (#1067): the local daemon relays the run to it. "This machine" while genuinely on a remote daemon instead calls `onConnectLocal` — go home (#1066).
- One checkmark, never doubled: a driver row is checked only when no device is the target (`driverChecked`); on a remote daemon the connected device carries the mark; picking any driver row also calls `onSelectDriver()` to clear the device selection.
- A disabled row's reason rides its description text, because tooltips do not open on disabled dropdown items.
- The sub-trigger summary shows the connected device's label, else the selected device's, else the current driver label.

## Facts

- `OptionLabel` moved to `ui/option-label.tsx` (#948) so menus without preference wiring can share it, but stays re-exported from this module — the established import site.
- A `selectedDeviceId` pointing at a removed profile reads as no selection.
