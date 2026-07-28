Tests for `Composer.tsx` (#721) — covers the control row across modes, preset semantics, carried drafts, and offline-target blocking.

## TLDR

- Control row renders in full and compact modes (compact keeps agent/model + gear, #755); `showAgentModel=false` drops only the select (#831).
- Option-label honesty (#801): Autopilot's tooltip promises only the countdown (the maintenance claim died with #556), Browser is disabled with a reason off Claude Code, Auto maintenance is gated on Post-merge cleanup.
- Submit: hidden until text, fires `onSubmit(text, 'build', {newSession:false})`, editor Cmd/Ctrl+Enter path works, `onPromptChange` mirrors edits.
- Presets (#959): a new-session preset submits `{newSession:true}` with the preset's rendered prompt (label ≠ prompt — the same string once shipped an import asking for nothing, #697); emptying the box drops the rule.
- Carried drafts (#1066/#1139): rehydrated from `sessionStorage['fw.pending-draft']` once, launcher-only, and asserted to be IN the editor, not just in what submit would send.
- Offline "Run on" device (#1073): disables submit + editor shortcut with the reason; an online device leaves Start enabled.

## Facts

- The `PromptEditor` stub deliberately models the real editor's `loadTemplate` no-op-until-resolved behavior (Tiptap `immediatelyRender: false`): a stub answering synchronously is exactly why a carried draft passed here while arriving as an empty composer in a real browser.
- The stub also holds and renders its own text so tests can assert what is IN the box — the composer's `prompt` state used to be set alongside the editor call, so a dropped `loadTemplate` still submitted the right text while the user saw an empty box.
- Preferences, editors, projects, and the device-health telefunc are all mocked; `checkDevices` is `vi.hoisted` so per-test online/offline answers work.
