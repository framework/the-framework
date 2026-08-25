# Bug analysis: packages/framework/src/system-prompt.test.ts

## Business logic (high-level)

Node `node:test` suite covering two modules: the pure composition in `system-prompt.ts` and the
Node-bound `loadUserSystemPrompt` in `system-prompt-file.ts`. `system-prompt.test.SPEC.md` lists what
it is meant to pin; the tests match that list item for item.

What it actually pins, and how well:

- **The context-doc set** (exact `deepEqual` on the nine paths), the business-knowledge subset, and
  the negative half (the read-only pointers are *not* in the merge-update set). Strong: a doc added
  or reordered fails the first assertion, so the "additive and ordered" invariant is real.
- **The `node_modules/` regression (#1163)**: no doc's gloss may name that path, and the two
  format-bearing bullets must name a heading "section below" that actually appears in the same
  block. This is the strongest test in the file: it checks the spec text is present, that it opens
  with the heading the bullet names, and that it sits after the bullets. It would catch a rename of
  any of the three specs' H1 (I verified the three constants in `prompts.generated.ts` still start
  with `# Ticketing format`, `# TODO_AGENTS.md`, `# The data branch`).
- **Template content** (headings present, retired headings absent, the backlog file named via the
  shared `FLAT_TODO_FILE` constant, the workspace-boundary sentence from #1276, exactly one `${{`
  fragment). These are content assertions against a generated string; `prompts.generated.ts` is
  rebuilt on every test run, so they really do track `prompts/system_prompt.md`.
- **Split behaviour**: both halves, full rendering of the system half, and the
  heading-in-the-user-prompt attack. The attack test is meaningful — it passes a prompt containing
  `# User prompt` and asserts the system half is unchanged.
- **Composition exactness**: two `assert.equal` tests reconstruct the entire expected string
  (`[context, TICKETING_FORMAT, TODO_FORMAT, DATA_BRANCH_PROTOCOL, builtin, user].join('\n\n')` and
  `[block, AWAIT_PROTOCOL, SIGNAL_PROTOCOL].join('\n\n')`). This is the file's backbone: nothing can
  be inserted anywhere in the channel without failing one of them, which is exactly the #547
  guarantee the dashboard preview rests on.
- **Per-agent sections**: browser and hands-off each get a present/absent pair plus a
  survives-vanilla / dies-under-transparent pair.
- **Vanilla vs transparent**: vanilla keeps the emit protocols (the #500 regression), transparent
  empties everything regardless of the other options.
- **`SYSTEM.md` reading**: trimmed content, and absent/whitespace-only → `undefined`.

Ordering/async concerns: only the two `loadUserSystemPrompt` tests are async, and both `await` every
call inside a `try/finally` that removes the temp dir with `{ recursive: true, force: true }` — no
unawaited promise, no leaked temp dir on failure, and each uses its own `mkdtemp` directory so they
cannot collide even if run concurrently. Everything else is synchronous and side-effect free.

Coverage gaps (worth noting, none of them a defect in the tests):

- Nothing pins that `BROWSER_PROTOCOL` comes *before* `AWAIT_PROTOCOL` — only that the signal
  protocol is last. The browser-before-await ordering is stated in the SPEC and in the source
  comment but is unguarded; a reordering into `[AWAIT, BROWSER, HANDS_OFF, SIGNAL]` would pass every
  test here.
- No test combines `browser` and `handsOff`, the combination a hands-off Claude agent with a browser
  actually gets.
- The `renderSystemPrompt` fallback (heading missing → whole template becomes the system half) is
  never exercised, and the assertion meant to make it unreachable is weaker than the code's
  requirement (see Bugs found).
- `assert.match(block, /AWAIT[\s\S]*Ship small PRs\./)` (L171) proves built-in-before-user ordering
  only via the `AWAIT:` macro line inside the built-in prompt text — `systemPromptBlock` contains no
  `AWAIT_PROTOCOL` at all. It works today, but it is coupled to prompt wording the rest of the file
  treats as free to change; the exact-equality test at L200-208 is what really pins the order.
- `assert.ok(block.indexOf(spec) > block.indexOf(KNOWLEDGE_CONTEXT))` (L154) compares against index
  `0`, so it degenerates to "the spec is present and not at the very start". Harmless duplication of
  the stronger equality test.
- `assert.ok(!system.includes('decide alone'))` (L279) pins the absence of one phrasing of a
  behaviour that was removed; it cannot detect a differently-worded reintroduction.

## Functions (low-level)

### Module-level fixtures (L20-24)
`KNOWLEDGE_LINES` / `KNOWLEDGE_CONTEXT` / `CONTEXT_BLOCK` re-derive the expected rendering from
`CONTEXT_DOCS` and the generated spec constants rather than hard-coding it. Correct trade-off: it
means the doc-set test (L26) is the one place the actual content is asserted, and everything else
tests *composition* rather than restating text. If the bullet template in `systemPromptBlock`
changed (say to `* path — gloss`), L20 would change with it and the composition tests would still
pass — but the doc-set test would not catch it either. Acceptable: the bullet format is not a
load-bearing invariant.

### `CONTEXT_DOCS is the repo-context fragment (#683)` (L26-56)
`deepEqual` on the ordered path list, subset/negative-subset checks, the two "section below" gloss
regexes, and the `node_modules/` ban. `CONTEXT_DOCS.find(d => d.path === FLAT_TODO_FILE)` also
cross-checks the literal used in `system-prompt.ts` against the constant `promoteQueue` reads — if
they diverged, `find` returns `undefined` and the `?? ''` regex fails, so the test does catch it
(the `?? ''` does not mask the failure, it converts a would-be TypeError into an assertion failure).
Correct.

### `loadUserSystemPrompt reads and trims SYSTEM.md` (L59-67) and `… absent or empty` (L69-78)
Real filesystem round-trips in a temp dir; both await, both clean up. The second covers both the
absent branch and the whitespace-only branch in one test. Correct.

### `SYSTEM_PROMPT_TEMPLATE carries the built-in prompt sections (#326) verbatim` (L80-112)
Ten `includes` checks plus four invariants (backlog filename from the constant, no
`ANALYSIS_RESULT`, the workspace sentence, exactly one fragment). The `# User prompt` entry in the
heading list is the only guard on the split boundary and is weaker than what `renderSystemPrompt`
requires — see Bugs found. Everything else: correct.

### `… no longer carries the pre-#326-rewrite headings (#555)` (L114-120)
Three absence checks on retired headings. Can fail (a revert brings them back). Correct.

### `renderSystemPrompt splits the system and user halves` (L122-130) / `… not confused by a user prompt containing the heading` (L132-137)
The second is the security-shaped one and is genuinely adversarial (the prompt contains the exact
boundary heading). Both correct.

### `the channel carries the ticket and backlog format specs (#1163)` (L139-161)
Loops the three (heading, spec) pairs over the four sub-assertions, then the vanilla negative.
Strongest test in the file. Correct.

### `systemPromptBlock defaults …` (L163) / `… appends the user prompt after the built-in one` (L167) / `… removes the built-in prompt when vanilla is on` (L174) / `… prepends a Context line (#439)` (L179) / `… knowledge docs after the user dirs (#537)` (L186) / `… no knowledge docs when vanilla is on` (L193) / `… and nothing else (#457)` (L200) / `… ignores a whitespace-only user prompt` (L210) / `… threads tf through to the template` (L215)
Together these cover every branch of `systemPromptBlock`: dirs present/absent/blank-only, docs
on/off, user present/blank/absent, and the whole-string equality. The trimming assertions
(`' /work/ui '` → `/work/ui`, `['  ']` → dropped) exercise the exact `map(trim).filter(Boolean)`
path. The `tf` test asserts the *negative* — the prompt text must not appear in the block — which is
the right assertion, since the system half has no fragment. All correct.

### `composeAgentSystem …` (L222-303)
Nine tests: the exact-equality baseline, the "nothing appended whatever the options" pair, the
browser present/absent/vanilla/transparent set, the hands-off present/absent/ordering/vanilla/
transparent set, the vanilla-keeps-protocols regression (#500), and the transparent short-circuit
(including with contradictory options set). The hands-off ordering assertion
(`indexOf(HANDS_OFF) > indexOf(AWAIT)`) plus `endsWith(SIGNAL_PROTOCOL)` pins the tail order
precisely. All correct; the only untested placement is browser-vs-await.

## Bugs found

1. **L91 — the only guard on the `# User prompt` split boundary asserts a weaker string than
   `renderSystemPrompt` requires.** `renderSystemPrompt` (system-prompt.ts L158) splits on the exact
   `'\n# User prompt\n'`, but this test asserts only `SYSTEM_PROMPT_TEMPLATE.includes('# User
   prompt')`. Scenario: `prompts/system_prompt.md` is an explicitly living document; if an edit
   leaves the heading with a trailing space, makes it the file's first line, or the file is
   rewritten with CRLF endings, `indexOf` returns `-1`, the *whole* template silently becomes the
   system half, `${{tf.prompt}}` is rendered inside the system channel (and the prompt is also sent
   as the opening turn, so it is delivered twice) — while this test still passes and the
   "a user prompt can never move the boundary" guarantee inverts. Severity: minor (latent; the
   shipped markdown is correct today). Fix: assert the split string itself,
   `assert.ok(SYSTEM_PROMPT_TEMPLATE.includes('\n# User prompt\n'))` — or make
   `renderSystemPrompt` throw instead of degrading when the slot is missing.
