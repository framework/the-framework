# Bug analysis: packages/framework/dashboard/components/SettingsPage.tsx

## Business logic (high-level)

The Settings page (#958): every user preference in sections, plus the onboarding checklist.
Checked against the SPEC:

- **Subtitle / one writable tier**: exact SPEC wording rendered; every control writes through
  `updatePreferences` (the global tier) — no repo-file writes anywhere. Holds.
- **Onboarding**: checklist at the top, no dismiss affordance. Holds.
- **Appearance**: Theme (system/light/dark via `themePreference`) and Editor (auto-detect `''` +
  detected editors). Holds. Edge noted: a stored editor bin that is no longer detected leaves the
  select's value unmatched (browser shows Auto-detect while the stored preference differs) —
  cosmetic drift only, and reachable only by uninstalling an editor after picking it.
- **Agent**: driver (defaults to `DRIVERS[0]`), model as free text (empty = CLI default,
  placeholder says so), run target (local/actions/web via `RUN_TARget_LABELS`), then
  `DevicesSettings` immediately after, per SPEC. Holds.
- **Run options**: the same `agentOptionRows(preferences).main` table the launcher renders; a
  disabled row stays, dimmed, with `disabledReason` in place of its description
  (`OptionToggleRow`). `row.checked` is the effective value. Holds.
- **Notifications**: browser row reads off and is disabled when permission is denied, with the
  blocked description; Discord row's description flips on `webhookReady` (null channels — not
  yet read — deliberately counts as ready, matching notify-channels' documented null-is-capable
  contract) and carries the Set up / Webhook button; categories with the SPEC's defaults
  (Human Queue `?? true`, New activity `?? false`). Saving in the dialog calls
  `reloadNotifyChannels`, settling all surfaces. Holds.
- **Automation**: Auto PM toggle; spend offset shown as the default-in-force to one decimal when
  unset (`round((offset ?? DEFAULT_SPEND_OFFSET)*10)/10` → 7.1) and clamped to
  ±`MAX_SPEND_OFFSET` as typed — but the empty/partial-input handling writes a spurious 0,
  bug 1.
- **Claude web**: rationale sentence, bridge toggle, `BridgeSettings` below. Holds.
- **Empty pickers render nothing**: `SelectRow` returns null for zero options (#1172). Holds.

Cross-cutting: the page is a pure projection of module-cached preferences; writes are
best-effort by design (preferences.ts). No effects/listeners owned here beyond `useState` for
the dialog. Nothing to leak.

## Functions (low-level)

### `SettingsPage({ onAgentStarted })`

Composition; see sections above. One wart: the props type declares `onDone?: () => void` and
App.tsx passes `onDone={showDashboard}`, but the parameter is never destructured and no control
on the page invokes it — either a lost "Done" affordance or dead code on both ends (bug 3, low
confidence). Otherwise correct.

### `Section`, `Row`

Presentational; `dimmed` greys the label only, description stays muted either way. Correct.

### `OptionToggleRow({ row })`

`description={(disabled ? row.disabledReason : row.description) ?? row.description ?? ''}` — a
disabled row missing a reason falls back to its normal description rather than blank; enabled
rows always have descriptions in the current table. `onCheckedChange` funnels through
`row.patch(next === true)`, so the publish-ladder ordinal semantics live in one place. Correct.

### `ToggleRow`

Checkbox + optional action button; `disabled` dims and blocks. Correct.

### `SelectRow`

Null for empty options; controlled select; `aria-label` names it for tests and AT. Correct.

### `TextRow`

Controlled text input; every keystroke writes the preference — fine for the model field (partial
model names are just strings, and the write path is cheap and last-write-wins). Correct.

### `NumberRow`

Controlled number input, clamps and rounds on change. The clamp fulfills the SPEC's "a typed
value is held to that range as it is entered" and the display fix for the 9999 case — but
`Math.round(Number(e.target.value) || 0)` turns the two *non-values* into a stored 0: see bug 1.
Verdict: bug found.

## Bugs found

1. `L422` (`NumberRow.onChange`): clearing the spend-offset box — or typing the leading `-` of a
   negative offset into an empty box — immediately saves `autoSpendOffset: 0`. A number input
   reports `''` for empty and for partial entries like `-`; `Number('') === 0` (and `NaN || 0`
   is 0), so the handler stores 0 and the controlled value re-renders as `0`. Concrete scenarios:
   (a) select-all + type `-20`: the `-` keystroke yields `''` → 0 is stored and displayed, the
   subsequent `2`/`0` compose to **+20** — the user asked to hold unattended work 20 points back
   and stored a value that lets it borrow 20 points ahead; (b) simply clearing the box converts
   "unset → default (+7.1, the half-day cushion the daemon uses)" into a permanent explicit 0.
   This contradicts the section's own rationale (the page must not "disagree with what the
   daemon does"/show-0-for-unset — here it *creates* the 0) and the SPEC's negative-offset
   affordance ("Negative holds it back"); the repo already knows this exact trap — RoutineWork's
   concurrency handler guards it explicitly ("An emptied box is mid-edit … `Number('')` is 0,
   not NaN"). Severity: major (silently stores a wrong quota-governing value, including
   sign-flipped ones, on ordinary editing gestures). Fix: mirror the concurrency guard —
   `const typed = e.target.value.trim(); if (!typed) return; const n = Number(typed); if
   (!Number.isFinite(n)) return; onChange(clamp(round(n)))` (ideally with a local draft so the
   box can sit empty mid-edit).
2. `L36` (`onDone` prop) + App.tsx L277: App passes `onDone={showDashboard}` but SettingsPage
   never uses the prop — no control on the page can return the user to the dashboard through it.
   Either a "Done" affordance was lost in a refactor, or both the prop and App's argument are
   dead code (the repo's rules call for deleting unnecessary code either way). Severity: minor.
   Confidence: low (the SPEC names no Done control, so this may be vestigial rather than
   broken). Fix: drop `onDone` from the props type and from App's call — or render the Done
   button that calls it, if the affordance was intended.
