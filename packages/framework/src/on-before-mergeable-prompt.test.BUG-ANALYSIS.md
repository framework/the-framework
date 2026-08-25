# Bug analysis: packages/framework/src/on-before-mergeable-prompt.test.ts

## Business logic (high-level)

Six tests over a pure renderer. Three assert properties of the *template constant* (structure that
must not drift from other modules' constants), three assert properties of the *render*.

What is genuinely pinned:

- **Template/code agreement on `TODO_AGENTS.md`.** The assertion is built from `FLAT_TODO_FILE`
  rather than a literal, so renaming the queue file in `tickets.ts` fails here instead of silently
  shipping a prompt that names a file the framework no longer drains. Same technique as
  `system-prompt.test.ts` (#885). Real coupling, correctly pinned.
- **Both queued presets are addressed by `filePath`.** Loops over `['maintainability',
  'security_audit']` asserting `tf.presets.<stem>.filePath` appears. This catches a prompt rewritten
  to hardcode `.the-framework/presets/...` (which would then not follow `PRESET_DIR`), and catches
  a dropped preset.
- **Template/code agreement on the knowledge docs.** Loops `BUSINESS_KNOWLEDGE_DOCS` asserting each
  `doc.path` appears in backticks. The comment explains precisely why only the business-knowledge
  subset and not the wider `CONTEXT_DOCS` is pinned - the agent reads more than it updates. This is
  the assertion that stops "told to read one set of files, told to update another".
- **No nested fragments.** Re-implements the renderer's own non-greedy regex, then checks each
  match's body for a second `${{`. Because the regex is non-greedy, a nested fragment
  `${{ a ${{ b }} }}` matches as `${{ a ${{ b }}`, whose `.slice(3)` still contains `${{` - so the
  detection works on exactly the malformed input it is meant to catch, rather than accidentally
  passing. This is a structural test that would fail the moment someone re-flattens the prompt
  wrongly, which is the stated failure mode (#556).
- **The rendered entries name the session.** Two `assert.match`es on the full entry text, plus
  `!prompt.includes('${{')` proving nothing was left unrendered. The regexes include the literal
  `.the-framework/presets/<stem>.md` path, so they also cross-check `presetContext()`'s output
  against the prompt - the only place the default is verified end to end.
- **The missing-name backstop.** `assert.throws` with a predicate requiring both
  `TemplateFragmentError` and `/session_name/` in the message. Correctly written as a callback
  (not an awaited async), and the cast `undefined as unknown as string` is what lets the runtime
  behaviour be tested past the type. Would fail if `renderTemplate` ever downgraded
  undefined-fragments to empty strings.

Lifecycle/ordering: all six are synchronous, share no state, and touch no disk. Nothing to leak.

## Functions (low-level)

Each `test(...)` body, with a verdict:

1. `ON_BEFORE_MERGEABLE_PROMPT_TEMPLATE carries the built-in ... block` - three `assert.ok`s on
   `includes`, all derived from constants or stable headings. Correct.
2. `the business-knowledge section names every business-knowledge doc (#537)` - loop with a
   per-doc message. If `BUSINESS_KNOWLEDGE_DOCS` were ever empty the loop would vacuously pass, but
   the preceding `## Business knowledge` assertion keeps the test from being wholly empty. Correct.
3. `the template never nests a fragment inside another (#556)` - see above; `?? []` handles a
   template with no fragments (would then vacuously pass, but test 1 and 4 already prove fragments
   exist). Correct.
4. `renderOnBeforeMergeablePrompt names the session on every entry` - correct, and the strongest
   test here.
5. `renderOnBeforeMergeablePrompt defaults absent settings to off rather than throwing (#556)` -
   see the bug below. The half that still bites is implicit: the call itself would throw if the
   template grew a `tf.settings.*` fragment, so the test is not *entirely* inert - but neither of
   its two explicit assertions can fail.
6. `... throws a useful error when the session name is missing (#556)` - correct.

## Bugs found

1. `L47-L53`: this test's stated subject no longer exists in the template. Its comment claims "the
   template reads `tf.settings.technical_control`, so an absent `settings` would throw on the
   property access"; `prompts/on_before_mergeable_prompt.md` contains no `tf.settings` fragment and
   no `readability` preset entry at all. Consequently `assert.doesNotMatch(prompt, /readability/)`
   cannot fail for any input, and `assert.equal(prompt, renderOnBeforeMergeablePrompt(same input))`
   compares the pure renderer against itself - also unfailable short of the function becoming
   non-deterministic. Scenario: someone reading the suite believes "absent optional settings read
   as off" (a claim the SPEC still makes) is covered, when nothing verifies it. Severity: minor.
   Confidence: medium. Fix sketch: delete the test and the SPEC's settings sentence, or - if the
   defaulting is meant to come back - assert the concrete behaviour instead (e.g. that the render
   of a context with only `session_name` equals a fixture, so any new fragment is noticed).
