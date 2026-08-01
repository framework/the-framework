The shared run composer (#721): the Tiptap prompt editor plus the control row (presets, context, agent/model, options gear, submit), factored out so the launcher (StartRunForm) and the run-view chat (RunComposer) get the exact same surface.

## TLDR

- Caller owns submit: `onSubmit(text, kind, {newSession})` — the launcher starts a run, the chat sends a message. `kind` is `'prompt'` once a preset was loaded, `'build'` otherwise; emptying the box resets to `build` and drops the preset's `newSession` flag (#959).
- `AGENT_UI` maps each `AgentName` to its logo + model list (Claude: Fable/Opus/Sonnet/Haiku; Codex: GPT-5 Codex/GPT-5/o3; empty value = agent default, no `--model` flag). The `Record<AgentName, …>` shape makes a new framework-side agent a compile error here rather than a silently missing menu entry.
- Presets (#353/#433/#874) render from `LAUNCHER_PRESETS` against the hosting session (`sessionName` → `session_name` template var); loading one prefills the editor and flips kind to `prompt`; `newSession` presets (#959) tell in-session hosts to open a new run. Custom (#626) and project-committed (#1025) presets ride the same menus.
- Devices/run-target (#1050/#1052/#1067/#1072/#1073): the gear's "Run on" section carries saved device profiles with online/offline polling; an offline selected device disables submit (click AND keyboard) with a `role="alert"` note pointing back to "Run on" — no auto-fallback.
- Modes: `compact` (#723/#755) is the one-row navbar quick-launch keeping agent/model + gear (their earlier omission meant navbar runs silently used stored options); `showAgentModel=false` (#831) for in-session (a session is bound to its start agent); `inSession` (#833) empties the gear's run options and drops the "In play" strip (both would read as controls over this session that only rewrite the next one).
- Loads its own project list for the `@` picker (#743) rather than making every host pass it; exposes `clear()`/`focus()` via `ComposerHandle`.

## Problems

- Double-submit race (#948): two fast Cmd+Enter presses both read `busy === false` (React state lags), firing two starts. `submittingRef` is a synchronous latch flipped before any await.
- Carried drafts (#1066/#1139): a draft from a device hop or a navigating click is handed to the editor as `initialText`, NOT pushed through the handle — `loadTemplate` silently no-ops until Tiptap has resolved (`immediatelyRender: false`), so pushing at mount dropped the draft and left an empty composer. `stashDraftFromUrl` is idempotent, so calling it here is race-safe with the SPA-entry call; drafts are taken once, launcher-only, and stay `build` kind.

## Decisions

- The submit arrow only exists once the prompt has text (#721); it animates in via negative margin (`-2.375rem` = its `w-8` + the row's `gap-1.5`) rather than width so the neighboring control slides smoothly and a hidden submit leaves the gear flush with the box edge; `aria-hidden` while empty keeps it out of role queries.
- `idleControl` (#1455): an optional node that occupies the submit slot while the box is empty — the session page's Stop/Resume, so Start/Stop/Resume and the send ↑ are one slot (like Claude Code's composer). Typing swaps it for the arrow; without one, the empty slot keeps its collapse behavior for the launcher.
- Run-option rows come from `lib/run-option-rows.ts` because the settings page renders the same options — a second copy would let a rule hold in one place and not the other (#958).
- Current connection is read once from `window.location` (not state): a device switch reloads the page, so the origin is fixed for the page's life.
- "New preset…" appears in the `/` menu only in the full composer — the compact row has no create panel to open.

## Flows

- submit: trim → guard (busy/latch/offline) → `onSubmit(text, kind, {newSession})` → latch released on settle.
- preset load: `/` menu or Presets button → `editorRef.loadTemplate` (menu path) → `setKind('prompt')`, `setNewSession` → `onPreset(label, replaced)`.
- preset create: PresetCreatePanel → save to preferences (`customPresets`) or the project repo (`saveProjectPresetList`) per chosen scope.
- device add: gear → AddDeviceDialog (portal, rendered by both modes) → profile saved → editor refocused.
