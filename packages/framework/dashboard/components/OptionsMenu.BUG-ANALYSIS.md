# Bug analysis: packages/framework/dashboard/components/OptionsMenu.tsx

## Business logic (high-level)

The composer's gear menu (#654): global-option checkbox rows that write preferences straight
through (menu stays open), plus — where a target can be chosen — the "Run on" submenu (#1050/
#1066/#1067): one flat single-select list of the three driver targets, then saved devices, then
"Add a device…", with exactly one checkmark. Selecting a device makes it the run target *in
place* (no navigation, no preference write); selecting a driver row writes the preference and
clears the device selection; on a genuinely remote daemon the connected device carries the mark
and "This machine" means go home (`onConnectLocal`, no preference write). The gear carries a
presence dot when ≥1 option is on-and-enabled, with the count only in the hover tooltip (#1046).
In-session composers pass no `agentTarget` and relabel to "Preferences".

Single-checkmark invariant, verified across the states:

- Local daemon, no device: `driverChecked(value)` marks exactly `control.value`; devices
  unchecked (`selectedDevice` undefined). ✓
- Local daemon, device selected: `selectedDevice` set → all driver rows unchecked (the
  `!selectedDevice` term), the matching device checked by id. A stale `selectedDeviceId`
  pointing at a removed profile yields `selectedDevice === undefined` → falls back to the driver
  mark, per the SPEC's "reads as no device selected". ✓
- Remote daemon: `onLocalDaemon` false → all driver rows unchecked; the device whose `url ===
  currentUrl` checked; an unsaved remote origin marks nothing and summarises as "A device". ✓

Other edges checked: the remove button rides `stopPropagation` so removal never selects
(test-pinned); disabled rows carry their reason in the description because tooltips don't open
on disabled items (comment + SPEC agree); `summary`'s `?? RUN_TARGET_ROWS[0]!.label` fallback is
dead code (`control.value` is typed `AgentTarget`) — harmless; the remove control being a nested
button inside a menuitem is unreachable by pure keyboard menu navigation — an accessibility nit
consistent with the SPEC's mouse-first wording, not a behavioural bug.

## Functions (low-level)

- `StatusDot({status})`: green only for `'online'`; offline and still-checking share the muted
  dot (SPEC: "muted while offline or still being checked"). Correct.
- `RUN_TARGET_ROWS`: labels from the shared `RUN_TARGET_LABELS`, honest "Claude web" description.
  Correct.
- `AgentTargetSub({control, connection, busy})`: derivations analysed above; driver click
  branches (`local`+remote → `onConnectLocal` *and return* — no preference write; otherwise
  `onChange` + `onSelectDriver`); device click → `onSelect`; add row disabled while busy.
  Correct.
- `OptionCheckboxRow({row, busy, indent})`: checked/disabled/onCheckedChange →
  `updatePreferences(row.patch(checked))`; reason appended with an em-dash, `filter(Boolean)`
  guards a row with no description. `indent` (pl-8) is accepted for the Eco sub-rows the header
  comment mentions, though no current caller passes it — dead-but-typed parameter, noted only.
  Correct.
- `OptionsMenu({options, busy, label, agentTarget, connection})`: `activeCount` counts
  checked-and-enabled; dot + tooltip; submenu then separator only when both halves exist; rows
  keyed by `o.key`. Correct.
- Re-exports (`OptionRow` type, `OptionLabel`): import-site stability shims, as commented.
  Correct.

## Bugs found

None found.
