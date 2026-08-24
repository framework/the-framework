# Bug analysis: packages/framework/dashboard/components/SystemPromptDisclosure.tsx

## Business logic (high-level)

The "Enhanced System Prompt" disclosure (#863): shows the full system channel an agent will receive,
composed by the very function the agent uses (`composeAgentSystem`), plus the two switches that shape
it (vanilla → "Anti-laziness…", transparent → "Integration with The Framework"). Invariants per
`SystemPromptDisclosure.SPEC.md`:

- **Same composition as the agent** — no second copy of wrapping logic. Holds for the logic; but the
  *inputs* are the caller's to supply, and the caller (StartAgentForm) does not supply every input the
  real run uses — see bugs.
- **Transparent is the master off-switch** — `composeAgentSystem` short-circuits to `''`, the empty
  branch renders ("only the built-in system prompt of your AI model provider"), the anti-laziness row
  shows off+locked with a title explaining why (`disabled={busy || transparent}` +
  `title` only under transparent). Matches spec.
- **Dot lit only when fully on** — `fullyOn = antiLazyOn && integrationOn` where
  `antiLazyOn = !disabled && !transparent`, `integrationOn = !transparent`. Matches spec including
  the "only the built-in block off still dims" case. State is also carried by sr-only text, not the
  dot alone.
- **Two switches write the same preferences as the gear** — via `onDisabledChange`/
  `onTransparentChange` callbacks; the component holds no state of its own, so it cannot drift from
  the gear. `onTransparentChange` optional → row reads fixed (`disabled` when absent). Matches spec.

Edge cases: `user` of `''`/null is dropped before composition (systemPromptBlock trims anyway —
equivalent). `context: []` adds nothing. Both checkboxes honor `busy`. The character count uses
`toLocaleString` on the composed text — always the displayed text's own length, cannot disagree.

The component's inputs vs. the real agent (checked against `src/agent.ts` + `src/cli.ts`):
`composeAgentSystem` in the agent path takes `vanilla, browser, handsOff, transparent, user, tf,
context`. The disclosure accepts and forwards all of these **except `handsOff`** — there is no prop
for it — and the browser value it is handed can differ from the one the agent really composes with
(see bugs; the second half of each fix lives in the callers).

Callers: StartAgentForm (launcher) and AgentComposer/agent view surfaces. For the launcher the claim
"nothing else is appended when the session starts" (rendered under the preview) is false for a
`target: 'web'` run.

## Functions (low-level)

- **`SystemPromptDisclosure(props)`** — the only export; stateless.
  - `text = composeAgentSystem({ vanilla: disabled, transparent?, browser?, tf: { prompt },
    context?, user? })` — verified argument-by-argument against the agent's own call in
    `src/agent.ts:151`. Missing: `handsOff` (bug 1). `browser` is caller-supplied and over-broad for
    non-local targets (bug 2, fix in the mapping).
  - `antiLazyOn` / `integrationOn` / `fullyOn` — booleans derived exactly as the spec's
    master-off-switch rule requires. Correct.
  - Trigger rendering — dot `aria-hidden`, state in `sr-only` span. Correct.
  - Anti-laziness checkbox — `checked={antiLazyOn}` (not `!disabled`!), so under transparent it
    *shows* off even when vanilla says on; `onCheckedChange` inverts to `onDisabledChange(!checked)`.
    Unreachable while transparent (disabled). Correct.
  - Integration checkbox — `checked={integrationOn}`, `disabled={busy || !onTransparentChange}`,
    optional-chained handler. Correct.
  - Preview block — non-empty branch shows `<pre>` + count + "This is the whole system prompt:
    nothing else is appended"; empty branch the transparent explanation. Rendering correct; the
    sentence's truth depends on bug 1.

## Bugs found

1. `L53-L60` (with the caller half in `StartAgentForm.tsx` ~L135-150): the preview omits the
   hands-off protocol for a `target: 'web'` run, so it under-reports the prompt. Concrete scenario:
   Settings → "Run on" = "Claude web"; the launcher's disclosure shows a prompt without
   `HANDS_OFF_PROTOCOL` and states "This is the whole system prompt: nothing else is appended when
   the session starts" — but the spawned CLI (`cli.ts:1276` maps `target` → `location`;
   `agent.ts:148-158` adds `handsOff: isHandsOff(location)`, true for `web`) composes the channel
   *with* the hands-off protocol appended. Contradicts the SPEC ("the preview is composed the same
   way the agent composes it, so the two can never disagree") and the file's own #547 claim ("this is
   the whole prompt for every agent kind, not a preview of most of it"). Severity: minor
   (informational surface, but its whole purpose is exactness). Fix sketch: add a `handsOff?: boolean`
   prop forwarded into `composeAgentSystem`, and have StartAgentForm pass
   `options.target === 'web'`.

2. Cross-file, noticed here (fix in `packages/framework/src/agent-options.ts` L81): the preview
   over-claims the browser section for a non-local run. `agentOptionsFromPreferences` emits
   `browser: true` whenever the preference is on and the driver is Claude, with no target gating —
   but the CLI only attaches the browser for a local agent
   (`cli.ts:1197 browserAttached = … && localAgent`) and prints "--browser has no effect with
   --run-on actions/web". So with Browser on and "Run on" = GitHub Actions, the disclosure (fed
   `browser={options.browser}` by StartAgentForm) renders the browser protocol section the agent
   will never receive — violating #824's "the system channel must only claim a browser the agent
   really has" as mirrored by the preview. Severity: minor. Fix sketch: in the shared mapping, emit
   `browser` only when `target === 'local'` (remote-device runs keep it: the device's own CLI runs
   locally there), which fixes preview and stops sending the no-op flag.

Noted, not reported: for a remote-device run (#1067 slice 1) the preview composes with the *local*
project's SYSTEM.md while the agent runs in the device's home checkout with its own SYSTEM.md — the
remote slice is explicitly partial ("which remote project it targets is a later slice"), so this is
in-progress-feature territory rather than a bug.
