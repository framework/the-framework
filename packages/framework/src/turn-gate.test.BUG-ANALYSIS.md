# Bug analysis: packages/framework/src/turn-gate.test.ts

## Business logic (high-level)

Pure-function tests for every parser in `turn-gate.ts` plus two behavioural tests for
`createTurnSignalEmitter`'s error dedupe. All tests are synchronous with no I/O, so there is no
missing-await or fixture-leak hazard anywhere in the file.

The `block(json)` helper (L6) wraps a JSON body in an `await-choices` fence *with leading prose*
("Here are the options.\n"), which is the realistic shape — the fence is never the whole message.
That matters: it exercises the fact that the block regexes are not anchored to the start of the
text.

What the suite pins down, mapped to the SPEC:

- **"One question shape"** — a well-formed gate, a multi-select with `default`, an approval with a
  `file`, and a `stop`-marked option are all parsed by the same code path with no gate kinds. The
  approval test's comment ("what used to be `await-confirmation`") records why.
- **"A bad block never breaks the agent"** — five malformed inputs in one test (invalid JSON, a
  JSON string body, an empty `options` array, an option with no label, no `options` key at all) all
  yield `undefined` rather than throwing; plus the newest-first fallback test, which is the only
  one that proves the `.reverse()` in `parseAwaitGate`.
- **Omission over falsy values** — `'multi' in gate` and `'file' in gate` are asserted `false`,
  which is stronger than `assert.equal(gate.multi, undefined)` and is what actually pins the
  conditional-spread style the module uses.
- **Views** — no block, a titled block with the heading stripped, the `Note` fallback, several
  blocks with a repeated title collapsing to the later one *in first-insertion order*, and a
  heading-only block yielding nothing.
- **Session name** — absent, slugified, first-non-empty-line, later-block-wins, the #939 `view`
  regression (both `View` and `view`), and a name with no usable characters. The #939 test pairs
  the session-name case with the markdown-view case in one test so the two fallbacks cannot be
  conflated again.
- **Ready for merge** — absent, with a newline body, and the body-less `` ```ready-for-merge``` ``
  form.
- **Pull request** — the commit-message split, absent, a body kept whole (including its own `##`
  heading and inline code), a one-line block, the >100-char paragraph rejection, later-block-wins,
  and empty-block handling (both alone and after a real block).
- **Errors** — absent, headline+detail split, one-line, every block kept in order, and empty blocks
  skipped (alone and mixed).
- **Emitter dedupe** — identical error restated across two turns emits once (asserted with a full
  `deepEqual` on the event array, so a spurious extra event fails); a second error with the same
  headline but a different detail emits twice, which is the case the "keyed by the whole block"
  rule exists for.

Notable coverage the file does *not* have (gaps, not bugs): nothing exercises `parseAwaitGate`'s
`recommended`-names-nothing branch, the emitter's session-name/ready-for-merge/PR dedupe (only the
error dedupe is tested here — the session-name and ready-for-merge dedupes are covered indirectly
by `todo-loop.test.ts`), and nothing covers a signal body containing a nested code fence, which is
the one input shape the parsers get wrong (see `turn-gate.BUG-ANALYSIS.md`).

## Functions (low-level)

### `block(json)` (L6)

Fixture builder. Correct.

### L12-95 — `parseAwaitGate` tests

Twelve tests. L21 and L64 and L94 use `deepEqual` on the whole options array, which pins the exact
shape (no stray `default: false`/`stop: false` keys). L31 pins synthesized ids `opt:0`/`opt:1`.
L36 pins label→id resolution. L40 pins last-block-wins and L45 pins the malformed-last-block
fallback — together they fully characterise the reverse scan. L49 batches five rejection cases in
one test; each is a distinct branch of `parseGateBody`. All real assertions.

### L97-123 — `parseMarkdownViews` tests

Four positives and one negative. L111's `deepEqual` on the whole array pins both the collapse and
the ordering (`plan` first even though its winning content came last), which is the `Map` insertion
-order behaviour. L121 pins that a heading-only block is skipped — worth noting because the SPEC
words this as "an empty one is skipped", and this test is what settles that a block containing only
a heading counts as empty.

### L125-154 — `parseSessionName` tests

Five cases across four tests, including both halves of #939. L148 additionally re-asserts the
markdown-view `view` fallback in the same test, deliberately, so the two cannot be re-merged.

### L156-160 — `parseReadyForMerge`

Three cases including the no-inner-newline form, which is the one the regex's optional group exists
for.

### L169-210 — `parsePullRequest` tests

Seven tests. L195's paragraph is 152 characters, comfortably over `MAX_PR_TITLE`, and the assertion
is `deepEqual` on `{description}` — so a regression that kept a truncated title would fail. L207
covers both "an empty block alone" and "an empty block after a real one" (the latter pins that
`continue` skips rather than overwrites `parsed`).

### L212-236 — `parseErrors` tests

Five tests, all `deepEqual` on the full array. L228 pins order across two blocks; L233 pins that a
whitespace-only block is dropped rather than emitting an empty headline.

### L238 / L246 — emitter dedupe tests

L238 asserts the *entire* event array equals a single error event, so any extra emission (a view, a
name) would also fail. L246 asserts `events.length === 2` — slightly weaker than a `deepEqual`, but
sufficient for the property under test. Both correct; neither can pass vacuously.

## Bugs found

None found.
