# Bug analysis: packages/framework/src/preset-catalog.test.ts

## Business logic (high-level)

One test file for the whole catalog: two *shared contracts* driven off table constants
(`PARAMETERIZED`, `PARAMLESS`), then per-preset assertions about the prompt content that actually
differs. Everything is synchronous and pure - no fs, no timers, no shared mutable state - so there
is nothing to leak or to order.

What is genuinely pinned:

- **The run-kind names, exactly.** `Object.values(presets).map(name).sort()` deep-equals a literal
  15-element list. This is the strongest test in the file: it fails on a rename, on an addition and
  on a removal, which is what forces an author who adds a preset to come back here (and therefore
  to notice the two contract tables below). Since `name` is also the materialized file stem and the
  launcher key, a silent rename would break the button and every queued TODO's path.
- **The parameterized contract.** For each of the six: exactly one param named `what`; the template
  really contains the `${{ tf.params.what }}` fragment; the default render produces "entire
  codebase" in the right sentence position (anchored with `^` for four of them); a
  whitespace-only `what` falls back to the default rather than erasing the target; a custom `what`
  lands in the same position; and no `${{` survives. The blank-falls-back case is the one that
  would regress if `value?.trim() || defaultWhat(ctx)` became `value ?? defaultWhat(ctx)`.
- **The paramless contract.** For each of the nine: `params` is empty, `render()` is byte-identical
  to `template`, and no `${{` remains. The last assertion is what makes the verbatim-render design
  safe - a fragment added to a paramless prompt would ship unrendered, and this catches it.
- **Gating polarity, per preset.** `ux` and both triage presets must contain no `<AWAIT>`,
  `<SHOW_CHOICES>` or multi-select (they run unattended); `research` and `suggestTicketsToWorkOn`
  must contain them (they gate). The triage test closes with a positive control
  (`suggestTicketsToWorkOn.template.includes('<AWAIT>')`), so the negative assertions cannot pass
  merely because the marker syntax was renamed everywhere - a genuinely well-built negative test.
- **The ux laziness guard**, called out as "the load-bearing half of the prompt", is asserted
  directly - without it the ratings come back all-10s and nothing is fixed.
- **research routes to a session-scoped TODO file**, asserted both positively
  (`TODO_<SESSION_NAME>.agent.md`) and negatively (`doesNotMatch(/TODO_AGENTS\.md/)`), pinning the
  #1370 decision that research follow-ups must not be deferred to a queue drain.
- **maintenance points at real materialized paths** using `presetFilePath(...)` rather than literal
  strings, so `PRESET_DIR` moving fails here instead of shipping a prompt pointing at a
  non-existent file. Plus `!out.includes('${{')`, which is the flattening guarantee.
- **The shared triage rule** is checked against `TRIAGE_SCOPE` itself (`endsWith`), not against a
  quoted phrase, so the pair cannot drift from the one file - and `TRIAGE_SCOPE`'s own key sentence
  is asserted once so the constant cannot be emptied.
- **`newAgent` exclusivity**: `filter(p => p.newAgent).map(name).sort()` deep-equals
  `['update-tickets']`, which fails both if the flag is dropped and if it spreads to another
  preset.
- **update-tickets' resume semantics** get eight separate content assertions (stamp file, key name,
  `updated:>=`, comments endpoint, "before you fetch anything", `.plan.md` preservation, closed
  handling, the `[Empty]` first-import branch), each corresponding to a numbered SPEC claim.

## Functions (low-level)

### `PARAMETERIZED` / `PARAMLESS` (table constants)

Six and nine entries; together they cover all fifteen catalog rows exactly (verified by
enumeration). Nothing in the file *asserts* that coverage, though - a newly added preset would be
absent from both contract tests. The exact-names test above is the compensating control: it fails
on any addition, forcing the author here. Acceptable design, worth naming.

### The test bodies

All synchronous, all using the third `message` argument of `assert.*` inside loops so a failure
names the offending preset rather than reporting an anonymous mismatch - the right pattern for a
table-driven test.

Notable weak spots (none of them wrong, all of them thin):

- `L52`: `assert.ok(preset.label, ...)` inside the launcher test cannot fail - `label` is a
  required field of `PresetSpec` and every row supplies a non-empty literal, so this is enforced by
  the compiler already.
- `L51`: `offered.length === Object.keys(presets).length - 1` plus "does not include drain-queue"
  does not prove the list is a *permutation* of the rest: a `LAUNCHER_PRESETS` that listed one
  preset twice and omitted another would satisfy both assertions, and the omitted preset would
  silently vanish from the launcher. Tightening it to a set comparison
  (`assert.deepEqual(offered.sort(), allNames.filter(n => n !== 'drain-queue').sort())`) would
  close it. A gap, not a defect in the code under test.
- `L227`: `assert.notEqual(prompt, presets.updateTickets.label)` is trivially true given the
  preceding assertions on the prompt's content.
- `L189-L199`: this test is *correct* and is what proves the module's own JSDoc and SPEC are stale
  about the triage collision guard (recorded as the bug in `preset-catalog.BUG-ANALYSIS.md`); the
  test itself asserts the current, intended behaviour.

Verdict: all tests correct - each has at least one assertion that fails if the behaviour it names
is removed.

## Bugs found

None found. (The stale triage-abort claim this file's L195 contradicts is recorded against
`preset-catalog.ts`, where the fix belongs.)
