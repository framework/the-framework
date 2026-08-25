# Bug analysis: packages/framework/src/preset-catalog.ts

## Business logic (high-level)

One table holding all 15 built-in presets, replacing what used to be 14 one-object files exporting
56 names. A row is the two or three values that actually vary: the run-kind `name` (the stable id
the launcher, the CLI subcommand, the agent record and `presetFilePath` all key on), the prompt
`template` (a generated constant, so the prose is edited once in `prompts/presets/<stem>.md`), the
launcher `label`/`tooltip`, an optional `what` description, and the optional `newAgent` flag.

Structural invariants, all verified:

- **Purity.** No `node:*` import, directly or transitively (`preset-prompt.js` ->
  `prompt-template.js` + `preset-registry.js`, both pure), which is what lets the dashboard render
  any preset in the browser (#520) and lets `client.ts` re-export it.
- **Two families.** A row with a `what` gets a single `what` param and a rendering `render`; a row
  without one is paramless and its `render` returns the template verbatim. The six parameterized
  rows are exactly `PRESET_STEMS` from `preset-registry.ts`
  (`maintainability, readability, security_audit, research, ux, maintenance`) after
  `name.replace(/-/g,'_')`, which is what makes `presets.ts#PRESETS` materialize precisely the
  quality presets to `.the-framework/presets/`. Checked: the sets match exactly, so no stem
  vanishes from the materialized map and no paramless preset is written to disk.
- **Verbatim rendering is safe today.** `definePreset`'s paramless branch never calls
  `renderTemplate`, so a `${{ }}` fragment in a paramless prompt would reach the agent as literal
  text. Verified by grep over `prompts/presets/*.md`: only the six parameterized prompts contain
  fragments (`tf.params.what` in five, plus `tf.presets.{maintainability,security_audit}.filePath`
  in `maintenance.md`), and `prompts/triage_scope.md` has none. The reliance is real but currently
  unviolated; it is also the SPEC's stated intent ("their prompt renders verbatim").
- **The triage pair shares one rule.** `triage()` appends `TRIAGE_SCOPE` (one file,
  `prompts/triage_scope.md`) to both templates with a blank line between, so the pair cannot drift
  on the queue-only rule (#1641). Because the append happens at `template` construction, both
  `.template` and `.render()` carry it.
- **Trailing newlines.** `scripts/gen-prompts.mjs` strips exactly one trailing newline per file, so
  `PRESETS_SUGGEST_NEW_TICKETS === 'Suggest new tickets'` and `template + '\n\n' + TRIAGE_SCOPE`
  ends exactly at the rule's last character. The generator runs on every build/test/typecheck, so
  the constants cannot drift from the markdown.
- **Drain recognition.** `drainsQueue` is the one behavioural function; see below.
- **Launcher list.** 14 entries = all 15 rows minus `drainQueue`, matching the SPEC's "every preset
  except drain_queue, which only the daemon fires". Verified no duplicates and no omissions by
  enumeration.

Lifecycle/concurrency: the module is a frozen-by-convention constant table evaluated once at
import. `definePreset` closes over `template`, and `render` builds a fresh context object per call,
so concurrent renders cannot interfere.

Cross-checked claims made in the JSDoc:

- `suggestTicketsToWorkOn` "is deliberately kept out of `AUTO_PM_JOBS`" - confirmed:
  `auto-pm.ts` L357-385 lists only `updateTickets`, `triageQuick`, `triageConsensual`,
  `planTickets`. Correct, and important: it ends in `<AWAIT>`, so firing it unattended would wedge
  an agent.
- `updateTickets` is the only `newAgent` row - confirmed by the catalog and pinned by a test.
- The triage pair's "aborts when `tf-<SESSION_NAME>` already exists" - **not** confirmed; see the
  bug below.

## Functions (low-level)

### `triage(template)` (private)

`` `${template}\n\n${TRIAGE_SCOPE}` ``. Pure, applied at module load to both triage rows. Two blank
lines between the prompt and the rule keeps them separate markdown blocks. Verdict: correct.

### `presets` (exported const table)

`as const satisfies Record<string, PresetDef>`: `satisfies` makes a malformed row fail to compile
while `as const` keeps each key's literal type, which is what `PresetKey` and the dashboard's
per-key lookups need. Each row's `name` is the on-disk/API identifier and is pinned exactly by a
test, so a rename cannot slip through. Fifteen rows; six parameterized, nine paramless. Verdict:
correct.

### `PresetKey` (exported type)

`keyof typeof presets`. Inert.

### `drainsQueue(prompt)`

In: arbitrary prompt text. Out: whether it is *the* queue-draining prompt.
`prompt.trim() === presets.drainQueue.render().trim()`.

- Comparing against the rendered preset rather than a copied phrase is what stops the recognition
  drifting when the prompt is reworded - the failure it prevents (a lane on the Overview quietly
  staying empty) is invisible, so this indirection is load-bearing.
- Exactness is also deliberate: a prompt merely mentioning the queue must not be mistaken for a
  drain, which would mislabel what an agent is implementing.
- `trim()` on both sides absorbs a surface that adds surrounding whitespace. Anything more (a
  prefix, a suffix, a normalized quote) makes it read false - which is the safe direction.
- `drainQueue` is paramless, so `render()` is a constant string; the only producer of a matching
  prompt is `auto-pm.ts` L394, which uses `presets.drainQueue.render()` itself. Verified the one
  consumer, `todo-loop.ts` L264, passes the agent's raw prompt.
- Empty/whitespace input returns false (the drain template is non-empty). Verdict: correct.

### `LAUNCHER_PRESETS` (exported const)

An explicit ordered list rather than a per-row flag, because membership and order are one decision.
Typed `readonly PresetDef[]`, so the array is not literally frozen at runtime but no code mutates
it. Verdict: correct.

## Bugs found

1. `L131-L133` (and `preset-catalog.SPEC.md`, "The triage pair"): the JSDoc states that each triage
   prompt "pins its own `<SESSION_NAME>` and aborts when `tf-<SESSION_NAME>` already exists. That
   collision guard is what makes them safe to fire on a schedule." No such abort exists any more:
   `prompts/presets/triage_quick.md` and `triage_consensual.md` contain only the
   `Always set <SESSION_NAME> to ...` line, `preset-catalog.test.ts` L195 explicitly asserts
   `doesNotMatch(out, /already exists/)` with the comment that the real guard is the routine lock
   on the data branch (#1659), and `worktrees.ts` records the abort as "retired by the routine
   lock, #1659". Scenario: a reader (or an agent editing the pair) trusts the comment and the SPEC,
   believes the prompt still self-guards against a double-fire, and removes or bypasses the routine
   lock - the actual guard - leaving Auto PM able to triage twice on overlapping firings. It also
   contradicts the SPEC's own rule that the SPEC describes current behaviour. Severity: minor.
   Confidence: high. Fix sketch: rewrite the JSDoc paragraph and the SPEC's "The triage pair"
   bullet to attribute the collision guard to the daemon's routine lock (#1659) keyed on each
   preset's fixed session name, and drop the branch-abort sentence.
