# Bug analysis: packages/framework/dashboard/components/AgentActionsMenu.tsx

## Business logic (high-level)

The ⋮ overflow menu for one agent. Per its SPEC: open on GitHub (when the remote URL is known),
open folder / open in editor (the agent's own checkout while it has one — `active ||
retainedWorktree` — else the project root, renamed and explained on hover), preferred-editor
submenu (detected editors + "Default", the remembered-but-undetected editor still listed, saved
via `updatePreferences` without closing the menu), the driver-session link, the session-id item
that copies a resume command (`mkdir -p <workspace> && cd <workspace> && <driver> --resume <id>`,
or just the id when no workspace was recorded) and flashes "Copied" for 1.5s, Stop and "Merge
when finished" while live, Remove worktree and Delete (confirmed in a dialog) once ended.

State machine notes:
- `hasOwnFolder = active || retainedWorktree` matches the SPEC's definition of "while it has
  one" (#737/E5); the naming and hover explanation follow it. Correct.
- Stop latch: `stopRequested` set only after `sendStop` resolves; `stopping = busy ||
  (stopRequested && active)`; reset only on `agentId` change. Two flaws: (a) `sendStop` resolves
  void even when the relay to a remote device failed (`relayOr(..., undefined)` in
  src/dashboard-rpc/control.ts swallows the unreachable case), so `.then(() => true)` records a
  landed stop that never landed (Bug 1); (b) the latch is never cleared when the agent ends, so
  a stopped-then-resumed agent (same id, same mount) renders Stop as a disabled "Stopping…"
  forever (Bug 2 — `isAgentActive` is deliberately segment-scoped, so `active` flips true again
  on resume while `stopRequested` is still true).
- Merge latch: `mergeRequested` set on `{ok:true}`; persisting across a stop/resume is *correct*
  because arming is run-level config daemon-side (`handoff-armed`, latest wins across segments).
- Deletion: menu item only opens the controlled `ConfirmDialog` (a menu item cannot be the
  dialog trigger); `onConfirm` maps `{ok:false}` to a rejection so the dialog shows the error;
  `onSuccess` = `onDeleted`. Matches the SPEC's naming/warning copy.
- Errors from `useAction` render inside `DropdownMenuContent`. Since ordinary items close the
  menu on click (Base UI default), a failure surfaces only when the menu is reopened — the error
  state persists, so it is discoverable, but the moment of failure shows nothing. Borderline
  against "Both report their failure inside the menu"; recorded as a concern, not filed, since
  the text does live inside the menu and reopening shows it.
- The header comment (L43-44) still describes a Serve item ("Serve keeps its state (Serve →
  Open/Stop…)") that the menu no longer renders and the SPEC no longer lists — stale comment,
  noted only.

## Functions (low-level)

- **derivations (L63-78)** — `active` (segment-scoped), `info = sessionInfo(events)`, `session =
  describeSessionLink(info)`, `resumeCommand = buildResumeCommand(info)`. Correct.
- **copy feedback (L81-91)** — `copied` + ref-held timer, cleared on unmount and on re-click.
  `navigator.clipboard?.writeText(...)` — the optional chain short-circuits the whole
  `.then(...)` when `clipboard` is undefined, so no crash, but also no copy and no feedback: on a
  dashboard reached over plain http from another machine (a first-class feature: non-loopback
  bind behind a token), `navigator.clipboard` does not exist outside a secure context and the
  item silently does nothing (Bug 3). Verdict: **bug found**.
- **`githubUrl` (L93)** — `useLoaded` with `keepPrevious`: holds the previous project's URL while
  the next loads (deliberate anti-flicker; a beat of a wrong link on project switch is the
  documented trade). Correct.
- **editor rows (L95-98)** — appends the remembered-but-undetected editor; tick via opacity on
  the current choice; "Default" documented as `$FRAMEWORK_EDITOR, or code`. Matches SPEC.
  Correct.
- **`openApp(target)` (L114)** — one `useAction` instance shared by open/stop/merge/remove: a
  slow open disables Stop/Merge/Remove via `busy` — conservative, acceptable. Correct.
- **`stopSession()` (L115-118)** — maps void to `true`; failure routes to `error` and leaves the
  latch unset. Correct locally; the remote-relay swallow makes it lie (Bug 1, fix daemon-side).
- **`mergeAgent()` (L119-124)** — guards on `agentId`; sets the armed latch only on `{ok:true}`
  (the unreachable-device relay answer is `{ok:false, error}`, which correctly surfaces).
  Correct.
- **`removeWorktree()` (L125-130)** — `result !== undefined` is the success test; `sendRemoveWorktree`
  returns a `RemoveWorktreeResult` object on success and `{ok:false}` failures are mapped to
  `undefined` by `useAction`, so the check is sound. Correct.
- **render (L134-279)** — items and separators gated as the SPEC orders; the between-section
  separator's condition mirrors the two ended-agent items exactly; the resume item requires both
  `resumeCommand` and `info?.sessionId`; the session-id slice (8 chars) matches the SPEC's
  "first characters". The delete dialog is mounted outside the dropdown so it survives the
  menu closing. Correct.

## Bugs found

1. `L116` (root cause: `sendStop`, packages/framework/src/dashboard-rpc/control.ts L50-54 with
   src/dashboard-rpc/relay-agent.ts): **Stopping a remote agent whose device is unreachable
   reports success — the menu reads "Stopping…" while the agent keeps running, with no error.**
   `sendStop` is relayed with `relayOr(..., undefined)`: an unreachable device resolves the void
   fallback, indistinguishable from a landed stop. The menu maps any resolution to `true`
   (`.then(() => true)`) and latches `stopRequested`, so the item shows a permanent, disabled
   "Stopping…" and the SPEC's "Both report their failure inside the menu" is unmet for Stop
   (contrast `sendMerge`, whose fallback is `{ok:false, error: 'could not reach the device'}`
   and does surface). Scenario: a saved-device agent is running, the device goes to sleep, the
   user clicks Stop — nothing stops and nothing says so. Severity: major. Fix: give `sendStop`
   a result shape like `sendMerge`'s (`{ok:true}` locally, `{ok:false, error: 'could not reach
   the device'}` as the relay fallback) and have `stopSession` latch only on `ok`.

2. `L103-L105`: **A stopped-then-resumed agent cannot be stopped again — Stop is stuck at
   "Stopping…".** `stopRequested` is reset only on `agentId` change, but resuming a stopped
   agent keeps the same id and the same mounted menu: the stop's `end` event flips `active`
   false (item hidden), the resume opens a new segment flipping `active` true again, and
   `stopping = stopRequested && active` re-disables the item with the "Stopping…" label even
   though no stop is pending. Resuming a stopped agent is a first-class flow
   (FEATURES-SPEC: "Resume a stopped agent"). Workaround is only to navigate away and back
   (remount resets the state), which nothing suggests. Severity: minor. Confidence: high.
   Fix: clear the latch when the agent stops being active — e.g.
   `useEffect(() => { if (!active) setStopRequested(false) }, [active])`.

3. `L86`: **The copy-resume item silently does nothing on a dashboard reached over plain http
   from another machine.** `navigator.clipboard` exists only in secure contexts (https or
   localhost); reaching the daemon at `http://<lan-ip>:4200` — the documented remote-access
   feature — leaves it undefined, the optional chain skips the write *and* the `.then`, so no
   command is copied and no "Copied"/error feedback appears; the SPEC promises "clicking that
   item copies a shell command … and flashes 'Copied'". Severity: minor. Fix: fall back to a
   temporary textarea + `document.execCommand('copy')` when `navigator.clipboard` is absent, or
   flash a "copy unavailable — select the command from the tooltip" state instead of nothing.
