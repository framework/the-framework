# Bug analysis: packages/framework/src/turn-gate.ts

## Business logic (high-level)

The *code side* of the turn-boundary protocol. The driver runs each agent turn as a black box, so
the only channel from agent to framework is fenced signal blocks in the turn's final message. This
module holds (a) the four protocol snippets re-exported from the generated prompts, (b) the parsers
for every signal block, and (c) `createTurnSignalEmitter`, which turns a turn's text into
`FrameworkEvent`s with per-span dedupe.

Invariants, against `turn-gate.SPEC.md`:

- **One question shape.** A single `await-choices` block with N options replaces the four former
  gate kinds. `stop: true` on an option is a property of the *question*, not of a gate kind.
- **A bad block never breaks the agent.** Every parser is total: malformed JSON, a non-object body,
  a missing `options` array, or options that all fall away yield "no gate", never a throw.
  `parseAwaitGate` scans blocks newest-first so a malformed last block falls back to a good earlier
  one — the reversal is on a fresh array from `blocks()`, so nothing is mutated in place.
- **Non-blocking signals.** Views, errors, session name, PR, ready-for-merge are recorded while the
  agent keeps going.
- **Once per span.** `ready-for-merge` fires once; the name and PR re-emit only on change; an error
  is keyed by headline+detail so a differently-failing retry is its own error.

Lifecycle: the emitter closure is the only state in the module, and each caller owns one for as many
turns as should share the dedupe (a build with its await rounds, or a whole backlog loop). Nothing
is async, so there are no ordering or race concerns beyond the caller's turn ordering.

**The one structural weakness**, shared by every parser here: the fenced-block regexes are
`` ```<tag>\s+([\s\S]*?)``` `` — a lazy scan to the *first* triple backtick. A signal body that
itself contains a fenced code block is therefore cut at the inner fence. The protocol text invites
exactly that (`open-pr`: "markdown, as long as it needs to be"; `error`: "what you ran, what it
said"; `show-markdown`: "a plan, a summary, a writeup"). Verified by probe: for
`` ```show-markdown\n# Report\n\nRan:\n\n```bash\nnpm test\n```\n\nAll green.\n``` `` the captured body
is only `"# Report\n\nRan:\n\n"`. See Bugs found.

## Functions (low-level)

### `AWAIT_PROTOCOL` / `HANDS_OFF_PROTOCOL` / `BROWSER_PROTOCOL` / `SIGNAL_PROTOCOL` (L16-42)

Re-exports of generated prompt text. No logic.

### `continuationPrompt(question, answer)` (L107) / `takeoverPrompt(...)` (L117) / `stopMessage(answer)` (L127)

Pure string builders. `continuationPrompt` interpolates the question inside double quotes, so a
question containing a `"` produces slightly odd but harmless prose. All three are the single
wording for their path, which is the whole point. Correct.

### `slugify(title, fallback)` (L142)

Lowercase, non-`[a-z0-9]` runs → `-`, trim leading/trailing dashes, `fallback` when nothing is left.
Non-ASCII (accents, CJK) collapses to dashes and can therefore vanish entirely — intended, since the
output has to be a branch-name shape. Correct.

### `parseMarkdownViews(text)` (L157)

Every `show-markdown` block → `{id, title, markdown}`. First `# ` line is the title (stripped from
the body), otherwise the title is `Note`. Blocks whose body *or* whose post-heading body is empty
are skipped — so a heading-only block yields nothing, which the test at
`turn-gate.test.ts` L121 pins deliberately. Same-slug blocks collapse to the later one while keeping
the first insertion's position (`Map.set` semantics), which the ordering assertion at L111 relies
on. Verdict: correct except the nested-fence truncation (below).

### `parseSessionName(text)` (L180)

Last non-empty `set-session-name` block wins; its first non-empty line is slugified with an *empty*
fallback, and emptiness is tested directly rather than by comparing against a sentinel — the #939
fix, so a session legitimately named `view` is not mistaken for "no name". Correct.

### `parsePullRequest(text)` (L224)

Last non-empty `open-pr` block; read like a commit message. A first line over `MAX_PR_TITLE = 100`
is not a title — the whole block becomes the description and the title falls back to the session
name downstream, rather than being cut mid-sentence into a permanent squash subject. `trimmed` can
never start with whitespace, so `first` is always non-empty when the block is non-empty. Correct
(modulo the nested-fence issue, which bites descriptions hardest).

### `parseErrors(text)` (L256)

Every non-empty `error` block, in order; first line headline, rest detail. Keeping all blocks (not
just the last) is the documented difference from the other signals. Correct.

### `parseReadyForMerge(text)` (L273)

`` /```ready-for-merge(?:\s[\s\S]*?)?```/ ``. The optional group requires a whitespace character
first, so `` ```ready-for-merged``` `` cannot match, while both `` ```ready-for-merge``` `` and a
block with a newline body do. Correct.

### `blocks(text, tag)` (L278)

Builds the per-tag regex. `tag` is always an internal literal, so the un-escaped interpolation is
not an injection surface. Requires `\s+` after the tag, so `` ```errors `` does not match `error`.
Returns a fresh array. Correct except the closing-fence rule (below).

### `parseRecord(body)` (L285) / `str(v)` (L297)

`JSON.parse` in a try/catch, rejecting non-objects (including `null` and arrays are *accepted* as
objects — but an array has no `options` property, so `parseGateBody` rejects it one line later).
`str` trims strings and maps everything else to `''`. Correct.

### `parseAwaitGate(text)` (L309) / `parseGateBody(body)` (L320)

- Options with no label are dropped; ids are synthesized from the *original* index (`opt:${i}`), so
  ids stay stable even when an earlier option is dropped.
- Zero surviving options → not a gate.
- `recommended` matches by id first, then by label; an unmatched name yields no `recommended`, and
  `requestChoices` then defaults to the first option.
- `multi` and `file` are omitted rather than set false/empty — pinned by two tests.
- A non-object option element (`null`, a string, a number) is handled by optional chaining.
- Verdict: correct.

### `createTurnSignalEmitter(emit)` (L363)

Closure over `named`, `ready`, `described`, `reported`. Order of emission within a turn: views,
errors, session name, ready-for-merge, PR. Each dedupe rule matches the SPEC. `seen` is built with
`pr &&`, so it is `undefined` when there is no PR and the `if (pr && ...)` guard is what actually
gates the emit. A PR that reverts to an earlier text *does* re-emit (only the immediately previous
value is remembered) — correct, since "changed back" is still a change the dashboard should show.
Verdict: correct.

## Bugs found

1. `L158` (and `L279`, the shared `blocks()` helper): every signal-block regex ends its capture at
   the **first** triple backtick, so a block body containing a nested fenced code block is
   truncated there — and for `show-markdown` the remainder is usually dropped entirely. Concrete
   trigger: an agent follows `prompts/protocols/await.md` ("show-markdown … a plan, a summary, a
   writeup") and emits

   ```
   ```show-markdown
   # Report

   Ran:

   ```bash
   npm test
   ```

   All green.
   ```
   ```

   The captured body is `"# Report\n\nRan:\n\n"` (verified by probe); after the heading is stripped
   the markdown is empty, so `parseMarkdownViews` returns `[]` and the user sees **no view at all**.
   The same cut silently truncates an `open-pr` description (the protocol explicitly says "markdown,
   as long as it needs to be") and an `error` detail (the protocol asks for "what you ran, what it
   said", which agents routinely fence). This contradicts the SPEC's "each `show-markdown` block
   becomes a rendered panel … the rest is its body". Severity: minor (lost or truncated display data,
   no corruption of state). Fix sketch: capture the opening fence length
   (`` /(`{3,})<tag>[^\n]*\n([\s\S]*?)\n\1/ ``) and require the closing fence to be at line start
   with at least that many backticks, so an agent can wrap a fence-containing body in ````` ```` `````;
   update the protocol snippets to say so.
