# Bug analysis: packages/framework/src/system-prompt.ts

## Business logic (high-level)

The single assembly point for an agent's **system channel** (`system-prompt.SPEC.md`). Everything
the framework injects as the session's system prompt is built here and nowhere else — the drift this
exists to prevent (#500/#501) was two call sites inlining the composition and one of them nesting the
emit protocols inside the built-in-prompt branch, which silently dropped them from `--vanilla` runs.
Today there is exactly one caller that matters (`runAgent`, agent.ts L151) plus the dashboard preview
(`SystemPromptDisclosure.tsx` L53) going through the same function via `client.ts`.

Responsibilities and invariants:

1. **Purity / browser-safety.** No `node:*` import may appear here or anywhere reachable from it,
   because `client.ts` re-exports `systemPromptBlock` / `composeAgentSystem` / `renderSystemPrompt`
   into the browser bundle. Verified: the module's three imports (`prompt-template.js`,
   `prompts.generated.js`, `turn-gate.js`) are themselves Node-free (`turn-gate.ts` imports only
   `events.js` types, the generated prompt strings and `await-gate.js` types;
   `prompt-template.ts` imports only `error-message.js`). `client.test.ts` walks the built graph and
   asserts no `node:` import, so the invariant is machine-enforced, not just documented.
2. **Fixed order.** context line + doc bullets → format specs → built-in prompt → user `SYSTEM.md`
   → [browser] → await → [hands-off] → signal. The signal protocol must be *last* (#547) so the
   preview can honestly claim to show the whole channel.
3. **One switch drives all framework-authored prompt content.** `includeBuiltin = opts.vanilla !== true`
   governs the context docs *and* the format specs *and* the built-in prompt together, so they
   cannot fall out of step. The user's own dirs and `SYSTEM.md` are not framework-authored and
   survive vanilla.
4. **Transparent short-circuits everything**, protocols included (`return ''`), so the agent is
   byte-identical to raw `claude -p`.
5. **The user-prompt boundary cannot be moved by the user.** The split happens on the *template*
   before `${{tf.prompt}}` is substituted, so a prompt containing `# User prompt` cannot smuggle
   text into the system half.

Concurrency/ordering: the module is pure and stateless — every export is a deterministic function of
its arguments plus the frozen generated prompt strings. No I/O, no caching, no shared mutable state,
so there is nothing to race. The only "lifecycle" concern is *when* it runs: the channel is composed
once per session before the driver starts, and `agent.ts` emits it as the `system-prompt` event, so
the store's copy is exactly what was sent.

Security: `renderTemplate` evaluates `${{ ... }}` fragments with `new Function` — arbitrary code
execution by design, so only trusted templates may be rendered. This module renders **only**
`SYSTEM_PROMPT_TEMPLATE` (the package's own generated markdown). The two untrusted strings it
handles — the user's `SYSTEM.md` (`opts.user`) and the picked dirs (`opts.context`) — are
concatenated verbatim, never rendered, and `tf.prompt` reaches `renderTemplate` only as an
*evaluated value* (the replacement is a function return value, so `$&`/`$'` in a user prompt cannot
corrupt the output either). Confirmed by reading `prompt-template.ts` L44-56. No injection path.

The one place the intent is *not* fully met is downstream: the SPEC's user story "The dashboard shows
the exact system channel an agent will receive, before it starts" is only true for the options the
dashboard actually threads through, and `handsOff` is not one of them (see Bugs found #1).

## Functions (low-level)

### `SYSTEM_PROMPT_TEMPLATE` (L31, exported const)
Alias of the generated `SYSTEM_PROMPT` string (built from `prompts/system_prompt.md` by
`scripts/gen-prompts.mjs` on every build/test/typecheck, so it cannot go stale). Verified the
generated text starts with `# System prompt` and contains exactly one `# User prompt` H1 at
markdown line 64, with a blank line before and after — the exact `\n# User prompt\n` shape
`renderSystemPrompt` splits on. Correct.

### `TfContext` / `DEFAULT_TF` (L38-50)
The template context. `prompt` is required; `session_name` is read only by the on-before-mergeable
prompt, never by this template (the system half has no fragment at all — a test pins that the whole
template has exactly one `${{`). `DEFAULT_TF = { prompt: '' }` means a caller with no context still
renders without throwing (`renderTemplate` only throws on `undefined`, and `''` is fine). Correct.

### `ContextDoc`, `DECISIONS_DOC` / `FACTS_DOC` / `INSIGHTS_DOC`, `BUSINESS_KNOWLEDGE_DOCS` (L52-71)
Path + gloss pairs. `BUSINESS_KNOWLEDGE_DOCS` is the merge-time write-back subset; the
on-before-mergeable prompt names the same set, and a test pins the correspondence. All three are
members of `CONTEXT_DOCS`, so the "subset" claim holds by construction. Correct.

### `CONTEXT_FORMATS` + the three heading constants (L93-101)
`[TICKETING_FORMAT, TODO_FORMAT, DATA_BRANCH_PROTOCOL]`, carried inline in the channel instead of
pointed at under `node_modules/` (#1163). The three heading constants must track each spec's own H1
or a bullet names a section that does not exist. Verified against `prompts.generated.ts`:
`DATA_BRANCH_PROTOCOL` starts `"# The data branch\n\n"`, `TICKETING_FORMAT` starts
`"# Ticketing format\n\n"`, `TODO_FORMAT` starts `"# TODO_AGENTS.md\n"` — all three match the
constants. Correct.

Note a soft coupling: `TODO_FORMAT_HEADING` is the literal `'TODO_AGENTS.md'` rather than
`FLAT_TODO_FILE` (tickets.ts is Node-bound, so importing the constant here would violate the browser
invariant — the literal is the deliberate cost). The test cross-checks it via `FLAT_TODO_FILE`, so a
rename is caught.

### `CONTEXT_DOCS` (L116-139)
Nine bullets, rendered as `- \`path\` (gloss)`. The `tickets/**.md` and `TODO_AGENTS.md` glosses
interpolate the heading constants and say "the … section below" — which is only true because
`systemPromptBlock` pushes `CONTEXT_FORMATS` *after* the bullets (L229). The two are wired
correctly, and the test asserts the ordering. Repo-root relative paths, matching the agent's cwd.
Correct.

### `renderSystemPrompt(tf = DEFAULT_TF)` (L157-165)
Splits `SYSTEM_PROMPT_TEMPLATE` at `'\n# User prompt\n'` (indexOf → first occurrence; the template
has exactly one), renders each half against `{ tf }`, trims both.

Edge cases:
- **Heading absent (`at === -1`)** → the *whole* template becomes the system half and the user half
  falls back to the bare `'${{tf.prompt}}'`. Since the whole template contains `${{tf.prompt}}`,
  that fallback would render the user's prompt *into the system channel* and again as the opening
  prompt (duplicated, and a user prompt would then sit inside the system half — the very thing the
  before-substitution split exists to prevent). Unreachable today: the shipped markdown has the
  heading. But the test that guards it asserts only `includes('# User prompt')`, which is weaker
  than the `\n# User prompt\n` the code requires — see Bugs found #2.
- **User prompt containing the heading** → harmless, because the substitution happens after the
  split. Pinned by a test.
- **`tf.prompt === ''`** → user half renders to `''`; `renderTemplate` throws only on `undefined`.
- **A fragment that throws** → `TemplateFragmentError` propagates out of `composeAgentSystem`, which
  in the dashboard would render-throw. Only reachable if the shipped template gains a broken
  fragment, which the test suite would catch first.
- `.trim()` on both halves is what makes `systemPromptBlock`'s `'\n\n'` joins produce clean
  separations.

Verdict: correct (with an unreachable-but-sharp fallback, noted above).

### `SystemPromptOptions` (L168-201)
Six optional inputs: `vanilla`, `user`, `tf`, `context`, `transparent`, `browser`, `handsOff`. All
are `boolean | undefined` / plain data; nothing here validates them because every caller is
in-process TypeScript (`agent.ts` spreads them conditionally; the dashboard passes booleans it owns).
`vanilla !== true` rather than `!vanilla` is a deliberate exactness, not a bug.

### `systemPromptBlock(opts = {})` (L211-233)
Builds the prompt-content block.

- `dirs`: trims each entry and drops blanks; empty/absent adds nothing. A dir containing a comma or
  newline would be ambiguous in the comma-joined line, but the values come from the registry / file
  picker, not free text.
- `Context:` head is emitted when there are dirs *or* docs; with `vanilla` and no dirs the whole
  block collapses and the function returns `''` (pinned).
- The specs and the built-in prompt ride the same `includeBuiltin` boolean — the SPEC's "driven by
  the one switch so they cannot fall out of step".
- `user` is trimmed and dropped when blank, so a whitespace-only `SYSTEM.md` adds no trailing
  separator.
- Join is `'\n\n'`, and every part is individually trimmed at its source, so no double blank lines.
- `renderSystemPrompt(opts.tf)` is recomputed on every call — the dashboard calls this on every
  keystroke of the composer, evaluating one `new Function` per call. One trivial fragment; not a
  concern.

Verdict: correct.

### `composeAgentSystem(opts = {})` (L255-267)
Assembles the final channel.

- `transparent` returns `''` first, so it overrides everything (pinned by tests, and `agent.ts`
  guards `if (system) emit(...)` so no empty `system-prompt` event is emitted).
- `promptBlock` is spread conditionally, so a vanilla channel starts with `AWAIT_PROTOCOL` rather
  than a leading blank line.
- Order: `[block?] [BROWSER] AWAIT [HANDS_OFF] SIGNAL`. Matches the SPEC exactly (browser ahead of
  the protocols; hands-off after await; signal always last).
- `browser`/`handsOff` survive vanilla (they describe the agent, not the prompt) and die with
  transparent — both correct by construction, both pinned.
- Nothing is appended downstream: `agent.ts` passes `system` straight to the driver session
  (L183) and never mutates it; the CloudDriver folds it into the handed-off prompt as `framing`
  (driver/cloud.ts L127/L132), so a hands-off agent really does receive `HANDS_OFF_PROTOCOL`.

Verdict: correct.

### Cross-file observations (not defects here)

- Every production agent path funnels through `cli.ts` → `runAgent`, and `cli.ts`
  (`resolvePromptConfig`, L487) is the only place `SYSTEM.md` is read, so a dashboard-launched agent
  gets the user prompt too (the daemon spawns the CLI). No second composition site exists.
- `agent.ts`'s `openingPrompt` skips the user-half framing for resumed/transparent/vanilla sessions —
  consistent with "no built-in prompt means no slot to render into".

## Bugs found

1. **L255 (`composeAgentSystem`) — the dashboard's "whole system prompt" preview omits the hands-off
   protocol for a `web`-target agent (defect lives in `dashboard/components/StartAgentForm.tsx` /
   `SystemPromptDisclosure.tsx`; fix there).** Scenario: the user sets Run target = "web" in
   Settings (`SettingsPage.tsx` L111 writes `preferences.target = 'web'`; `agentOptionsFromPreferences`
   L86 puts it on the start options), then opens "Enhanced System Prompt" in the launcher. The
   preview calls `composeAgentSystem({ vanilla, transparent, browser, tf, context, user })` —
   `handsOff` is never passed (SystemPromptDisclosure.tsx L53-60 has no such prop) — while the agent
   itself starts with `location: 'web'` → `isHandsOff` → `composeAgentSystem({ handsOff: true })`,
   which inserts `HANDS_OFF_PROTOCOL` between the await and signal protocols. The panel then states
   "This is the whole system prompt: nothing else is appended when the session starts", which is
   false for that agent, contradicting the SPEC user story "The dashboard shows the exact system
   channel an agent will receive, before it starts" and the component's own stated rule (its
   `browser` prop is threaded for exactly this reason: "the preview cannot claim a smaller prompt
   than the agent gets"). Severity: minor (display only; the agent's real channel is right).
   Fix: add a `handsOff?: boolean` prop to `SystemPromptDisclosure`, forward it into
   `composeAgentSystem`, and pass `handsOff={options.target === 'web'}` from `StartAgentForm`
   (beside the existing `browser={options.browser ?? false}`).

2. **L158 — the `# User prompt` split is guarded by a test that pins a weaker string than the code
   needs, so a legal edit to `prompts/system_prompt.md` silently leaks the user prompt into the
   system channel (fix belongs in `system-prompt.test.ts` L91, or in `renderSystemPrompt`).**
   Scenario: the prompt markdown is explicitly "Rom's living doc" and is edited freely; if the
   heading ever ends up without the exact `\n# User prompt\n` framing — e.g. it becomes the first
   line of the file, or gains trailing spaces (`# User prompt `), or the file is rewritten with CRLF
   line endings — `indexOf` returns `-1`, `renderSystemPrompt` falls back to "system half = the
   whole template", and `renderTemplate` then substitutes the user's prompt into the *system*
   channel (and returns it again as the opening prompt, so it is sent twice). The test that is
   supposed to prevent this asserts only `SYSTEM_PROMPT_TEMPLATE.includes('# User prompt')`, which
   still passes in every one of those cases, and the "not confused by a user prompt containing the
   heading" guarantee quietly inverts. Severity: minor (latent; not reachable with today's
   markdown). Fix: assert the split itself — `assert.ok(SYSTEM_PROMPT_TEMPLATE.includes('\n# User
   prompt\n'))` — or make the fallback loud (throw) instead of degrading, since a template without
   the slot is a build error, not a runtime state.
