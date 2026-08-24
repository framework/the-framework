# Bug analysis: packages/framework/dashboard/components/Composer.test.tsx

## Business logic (high-level)

Covers the areas its test SPEC lists: control row presence per host shape, submitting (button +
editor shortcut + mirror), presets (label vs rendered prompt, `newAgent` marking, emptied-box
reset), carried drafts (rehydrate once, really-in-the-editor #1139, launcher-only), offline/online
"Run on" device (#1073), and the in-agent gear lifecycle (#1172/#1469).

Harness quality:

- `vi.mock('../lib/preferences.js')` with a mutable `prefs` object read per render; editors,
  projects and device-check RPCs stubbed. All mocks reset in `beforeEach`, storage cleared,
  device selection reset — profile state is localStorage-backed so `localStorage.clear()` really
  isolates tests.
- The PromptEditor stub is the strongest part: it deliberately models Tiptap's
  `immediatelyRender: false` behavior — `loadTemplate` returns false and does nothing until an
  effect marks it ready, and `initialText` is applied only once ready. The long comment explains
  this reproduces the #1139 carried-draft regression class; the stub also *renders* its held text
  so `editorText()` can assert what is IN the box, decoupled from what submit would send. This is
  exactly the distinction that hid the original bug.
- `const { Composer } = await import(...)` after mocks — correct hoisting pattern.

Coverage gaps (not test bugs): the double-submit latch (#948) — SPEC'd ("a double submit cannot
start two agents") but untested here; `removeContext`/mention flow; the presets create/delete
paths; `idleControl` slot swapping (#1455 — covered in AgentComposer tests instead); the
in-session offline block bug found in the source (no test pins that a send inside a session is
NOT gated by the launcher's device target — had one existed, the Composer bug would have been
caught).

## Functions (low-level)

- `renderComposer(over)`: sensible defaults, returns `onSubmit`. Correct.
- `agentTrigger()` (L118): role query by the accessible name prefix `Driver: ` — tracks the #1143
  labelling rule. Correct.
- "renders the full control row" (L121): presence checks + tooltip content via `hoverTooltip`;
  submit appears after typing. Awaited where async (tooltip). Correct.
- "compact keeps the agent/model + options" (L133): control presence + a full type-and-submit
  round trip asserting the `('quick run', 'build', { newAgent: false })` contract. Correct.
- "showDriverModel={false} drops the select" (L145): asserts absence by the OLD trigger name
  (`'Default'`) — weak: the current trigger is named `Driver: …`, so `queryByRole('button',
  { name: 'Default' })` would be null even if the select were wrongly rendered. The test still
  passes for the wrong reason if the select leaks back in. However the positive assertions (gear
  present, submit works) hold, and `agentTrigger()` throwing is not asserted. Suspicious: an
  absence assertion that can no longer fail. Recorded as a test weakness (minor) — see Bugs.
- Option-label tooltip + Browser-off-Claude (L156, L168): scoped `within(menu)`, awaited tooltip.
  Correct.
- Submit visibility/fire, shortcut, mirror (L176, L187, L194): all synchronous through the stub;
  assert exact payloads. Correct.
- New-agent preset marking (L204): asserts the submitted text is the *rendered* preset
  (`presets.updateTickets.render()`), not the menu label, plus `newAgent: true`; counter-case
  ('Security audit') asserts `newAgent: false`. Cleanup between the two renders. Correct.
- Carried-draft trio (L223, L231, L242): asserts consumed-once (sessionStorage null), the #1139
  in-the-editor assertion via `editorText()`, and the in-agent no-consume (draft still stored,
  nothing seeded). Correct and falsifiable.
- Emptied-box preset drop (L249): works around jsdom's suppressed no-change events by first
  typing 'edited' — honest comment; asserts the final `('just a question', 'build',
  { newAgent: false })`. Correct.
- Offline device (L265): primes `checkDevices` → false, adds profile, selects it, waits for the
  note, asserts disabled + both submit paths blocked (`onSubmit` not called). Correct. Online
  counterpart (L280) waits for the poll, asserts no note and a working submit. Correct.
- In-agent gear (L296, L304, L319): gear absent live (all three trigger names probed), resume
  rows exactly (presence of the four, absence of prompt-shaping + Run on), and a toggle writes
  `updatePreferences({ browser: true })`. Correct.

## Bugs found

1. `L149`: the assertion that the driver/model select is absent queries
   `getByRole('button', { name: 'Default' })` — a trigger name that no longer exists anywhere
   (#1143 renamed it to `Driver: …`), so the check passes even when `showDriverModel={false}`
   fails to drop the select; the test can no longer fail on the behavior it names. Severity:
   minor (test-only; the behavior itself is currently correct). Confidence: high. Fix sketch:
   assert `screen.queryByRole('button', { name: /^Driver: / })` is null instead.
