# Bug analysis: packages/framework/dashboard/components/StartAgentForm.tsx

## Business logic (high-level)

The launcher's "Start an agent" form (#405): collects a prompt via the shared `Composer`, assembles
the agent's start options from persisted preferences via the daemon's own mapping
(`agentOptionsFromPreferences`, #858), and submits through `useStartAgent` → `sendStart` (one run per
project; `busy` refusal). Around the submit it renders: the Context selector (repos + files, #439),
the system-prompt disclosure (#863), and four pre-flight notices (#1326 driver readiness, #1419 gh
half, #1439 Haiku warning, #1417 auto-merge-disabled note).

Key invariants checked against `StartAgentForm.SPEC.md`:

- **Preset vs typed submit** (#1279): `submitKind === 'prompt'` adds `{ unattended: true }`; a typed
  `'build'` does not. Matches spec ("a preset is fired work").
- **Options read once**: `options` is computed from the same `preferences` snapshot per render and is
  used by both the submit closure and the disclosure props, so preview and submit agree. Correct: the
  submit closure captures the render's `options`; React re-renders on preference change so the closure
  is fresh.
- **Context split**: repo entries are recognized by membership in `projectPaths` (all registered
  project paths, current included), files are the rest; the current project is excluded from offer and
  count (#665). Correct. If `projects` has not loaded yet (`[]`), every context entry counts as a
  "file" momentarily — transient render-only state, self-corrects when `onProjects` resolves.
- **Remote device** (#1067): `remoteDevice` resolved synchronously from localStorage-backed
  `useConnectionProfiles()` + in-memory `useSelectedRemoteDeviceId()`; no async race at submit time.
  A selected device whose profile was deleted degrades to a local start silently — but the "Run on"
  gear owns that state and deselects on removal (out of scope here; noted as reliance).
- **Pre-flight gating**:
  - Readiness probed only for `localDriver` (`target !== 'actions' && !remoteDevice`) — matches spec.
  - `publishArmed` adds the gh half only when the handoff reaches `pr` (#1419) and only for a local
    driver — matches spec/tests.
  - `mergeArmed = options.handoff === 'merge' && !remoteDevice` — asked also for `target: 'actions'`
    runs; spec only exempts device runs, so this matches (the daemon's CI watch covers actions runs
    too).
  - `autoMergeDisabled` requires `known && !allowed` — "could not say" shows nothing (#1318 stance,
    pinned by tests).
- **Feedback placement** (#948): error/note under the composer; editing clears the error via
  `onPromptChange → reset()`; emptying the box clears the note. Note that the note is intentionally
  kept while a preset draft is being edited (only emptying clears it) — matches spec's "loading a
  preset says so".

Failure modes considered: double-submit is guarded both by `if (busy) return` and by the Composer
disabling its button; `useLoaded` drops stale async answers on dep change/unmount, so switching
driver mid-probe cannot show the wrong CLI's problems; a rejected probe keeps the previous value
(useAsyncValue), so a daemon hiccup does not flash warnings away — acceptable.

## Functions (low-level)

- **`StartAgentForm(props)`** — the only export.
  - `prompt` state mirrors the editor text for the disclosure preview; updated in `onPromptChange`.
    Correct.
  - `projects = useLoaded(onProjects, [], [])` — loaded once per mount; a repo registered while the
    form is open is not offered until remount. Deliberate simplicity, not a bug.
  - `userSystemPrompt = useLoaded(() => onSystemPromptUser(projectId), null, [projectId])` — re-read
    per project (#872). Correct.
  - `options` — spread of `agentOptionsFromPreferences(preferences, [...context])` plus optional
    `remote` (memory-only token, per spec never persisted — it is only sent with the start;
    verified `sendStart` posts it but nothing here writes it to storage). Correct.
  - `ready = useLoaded(..., [driver, localDriver, publishArmed])` — load closure closes over exactly
    the deps (contract of `useLoaded`). When `localDriver` is false the load resolves `null`, and a
    dep change resets value to `null` first, so an actions/device run shows no stale problems.
    Correct.
  - `repoAutoMerge = useLoaded(..., [projectId, mergeArmed])` — same pattern. Correct.
  - `submit(text, submitKind)` — guards on `busy`, sets note, awaits `start`, clears note, on success
    fires `onAgentStarted(text, agentId, remoteDevice?.label)`, clears composer + prompt. On failure
    `start` returns undefined and `error` renders. Correct. Edge: `remoteDevice` is read at render
    time, not submit time — same tick, no race (both synchronous stores).
  - Haiku warning: `options.model === 'haiku'` — see bug 1 below: not conditioned on the driver.
  - Auto-merge note: gated by `autoMergeDisabled`. Correct.
  - Rendering: `ready?.problems.map` / `ready?.warnings.map` keyed by message text — duplicate
    identical messages would collide keys; `driverReady` produces distinct lines (reliance noted).
    `role="alert"` for problems and warnings, `role="status"` for the informational merge note —
    consistent with tests.

## Bugs found

1. `L210` (minor, unproven-edge): the Haiku warning fires on `options.model === 'haiku'` without
   checking that the driver is Claude. The model preference is one free-form string shared across
   drivers (Settings page has a free-text "Model" row and a separate "Agent" select; registry
   `Preferences.model` is a single string), so a user who picked Haiku in the launcher and then
   switched the driver to Codex in Settings ends with `{ driver: 'codex', model: 'haiku' }` — the
   form then warns "Haiku consistently skips the session-finish protocol… Pick Fable" for a Codex
   run. Elsewhere the codebase deliberately refuses to attribute a model pinned on the other driver
   (`describeAgentSettings`/#1143 shows "the CLI's own default"). Severity minor (wrong teaching
   text, never blocks). Fix sketch: gate the warning on `driver === 'claude'` (or on the model being
   in the driver's own `DRIVER_MODELS` list). Note the deeper mismatch — `agentOptionsFromPreferences`
   passing a Claude model to a Codex CLI — lives in `src/agent-options.ts`, outside this file.
