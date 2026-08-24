# Bug analysis: packages/framework/dashboard/components/Composer.tsx

## Business logic (high-level)

The shared prompt box (#721): PromptEditor + control row (presets menu, driver/model menu, options
gear, submit slot), used by the launcher (StartAgentForm) and the in-agent chat (AgentComposer);
a `compact` single-row form exists for a navbar quick-launch. Carries: preset load (`kind:
'prompt'`, `newAgent` flag #959), emptied-box fallback to `build`, driver+model as one preference
pair, gear content by lifecycle (launcher full table / live agent none / ended agent
`resumeOptionRows` #1172), offline-target blocking (#1073), double-submit latch (#948),
carried-draft rehydration (#1066/#1139), and the one-slot submit/idle control (#1455).

Checked invariants:

- **Double-submit latch**: `submittingRef` flips before any await; `submit` refuses on
  `!text || busy || submittingRef.current || targetOffline`; reset in `.finally`. Correct against
  the two-fast-⌘↵ scenario. Reliances (documented, held by both hosts): `onSubmit` never throws
  synchronously (both hosts pass async functions) and never rejects (both route through
  `useAction.run`, which catches) — a rejecting `onSubmit` would surface as an unhandled
  rejection since the `.finally` chain is `void`-discarded.
- **Preset lifecycle**: `loadPreset` (from `/` menu) and `loadPresetFromMenu` (button) both set
  `kind='prompt'`/`newAgent`; `onPromptEdit` returns to `build` and drops `newAgent` only when the
  box is emptied — matches SPEC ("emptying the box is a fresh start"; an edited-but-nonempty
  preset still runs verbatim as prompt-kind, per SPEC). The imperative `clear()` resets
  prompt/kind but NOT `newAgent` — benign in every reachable sequence: submitting again requires
  typing or loading, and the first `onPromptEdit` with `kind==='build'` clears `newAgent`, while a
  preset load overwrites it. Noted, not a bug.
- **Carried draft**: launcher-only effect (`compact || inAgent` bail), `stashDraftFromUrl()`
  idempotent, taken once, delivered as `initialText` (the #1139 lesson — `loadTemplate` no-ops
  until Tiptap resolves). Correct; StrictMode double-run safe (second take returns null and
  `setCarriedDraft` is guarded truthy).
- **Offline target**: `targetOffline` only when a device is selected AND its status is exactly
  `'offline'` (unknown does not block) — matches SPEC. But the block applies in-session too — see
  Bugs.
- **compact**: the form exists and is tested, but no production host mounts `<Composer compact>`
  anymore (only StartAgentForm and AgentComposer render Composer; nothing in AppFrame does).
  The SPEC still describes "the navbar's quick launch". Dead-feature/stale-SPEC drift — the
  missing host is a missing feature, not a defect in this file; recorded here, not in the JSON.
  Also, the compact return omits `offlineNote`, so if a compact host returns, an offline target
  would disable submit silently (SPEC: blocked "and a message names the device") — latent only.

Dead locals: `vanilla`, `transparent`, `browser`, `theme`, `ecoDisabled` (L151–180) are computed
and never used — leftovers from rules that moved into `lib/agent-option-rows.ts`. Cleanliness
only; not reported.

## Functions (low-level)

- `DRIVER_UI` / `DRIVER_OPTIONS` (L49–59): `Record<DriverName, …>` makes a new driver a compile
  error; models come from the shared `DRIVER_MODELS`. Correct.
- `Composer` state wiring (L129–180): preferences-backed values; `projects` self-loaded for the
  `@` picker (#743). Correct.
- `useImperativeHandle` (L182–189): `clear` resets prompt+kind (not `newAgent`, see above; not
  `onPromptChange` — both hosts reset their own mirror after start). Correct-with-reliance.
- Draft effect (L200–206): see above. Correct.
- `submit` (L212–221): see latch analysis. Correct except the in-session offline block (Bugs #1).
- `loadPreset` / `loadPresetFromMenu` (L225–236): menu path calls `loadTemplate` then flags. Race
  window: if clicked before Tiptap resolved, `loadTemplate` silently no-ops but `kind` still
  flips to `'prompt'` with an empty box; the user's subsequently typed text would submit as a
  `prompt` (unattended at the launcher). Window is one render frame after mount — humanly
  unreachable through the two clicks the menu needs; suspicious-but-unproven, kept out of the
  report.
- `onPromptEdit` (L238–246): kind fallback + newAgent drop + mirror. `nextKind` computed from the
  closure's `kind`; batching order with `loadPreset`'s `setKind` works out (last set wins where
  it matters). Correct.
- `optionsGearEl` (L313–345): live in-agent → null; ended → `resumeOptionRows`, no target/
  connection sections; launcher → full rows + target + devices, remove clears selection if it was
  the target. Matches SPEC and tests. Correct.
- `submitButton` / `slotEl` (L354–387): appears only with text (`aria-hidden` + `tabIndex=-1` +
  `pointer-events-none` while empty — genuinely inert); disabled on busy/offline; tooltip states
  the shortcut; idleControl occupies the slot when empty. Correct.
- `offlineNote` (L390–394): full form only (see compact note). Message names the device with a
  fallback label. Correct in itself.
- Render paths (L402–465): compact row vs full box; "In play" row hidden in-session (#833);
  PresetCreatePanel saves to user prefs or project list and refocuses. Correct.

## Bugs found

1. `L216` (with `L143`): the offline-device block also applies inside a session. `targetOffline`
   reads the launcher's "Run on" selection, but the in-agent composer never targets that device:
   AgentComposer's sends go to the live local agent (`sendMessage`), and its resume/new-agent
   starts pass no `remote` option (the device token is attached only by StartAgentForm) — which is
   exactly why the target/"Run on" controls are hidden in-session (#833/#1050, resume rows
   exclude "Run on": "the continuation is pinned to its conversation"). Scenario: the user picks
   their desktop as the run target, the desktop goes to sleep, they open a running local agent and
   try to chat — the send button disables and the note says "Studio is offline. Pick another
   target in 'Run on' to start", but no "Run on" control exists on that page and the message never
   involved the device. Chatting with (and resuming) any agent is blocked by an unrelated setting.
   SPEC scope agrees: the offline rule is about *starting* on that device. Severity: major.
   Confidence: high. Fix sketch: exclude the in-agent host, e.g.
   `const targetOffline = !inAgent && !!selectedDeviceId && deviceStatus[selectedDeviceId] === 'offline'`
   (offlineNote follows automatically).
