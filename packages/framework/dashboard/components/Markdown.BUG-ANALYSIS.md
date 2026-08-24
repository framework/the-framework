# Bug analysis: packages/framework/dashboard/components/Markdown.tsx

## Business logic (high-level)

Dependency-free Markdown renderer for agent-written content (plans, TODO docs, pushed views,
chat replies). Security invariant (SPEC): output is built as React nodes only — no
`dangerouslySetInnerHTML`, so agent text can never smuggle live HTML; links render only for
`http(s)` targets (both `[text](url)` and bare URLs), everything else stays plain text, and all
links open `target="_blank" rel="noreferrer"`. Supported grammar: headings 1-6, bullet + task
lists, fenced and inline code, bold/italic, links, GFM pipe tables (#869). Malformed input still
reads: pipe runs without a separator second row render as the paragraphs they were; an unclosed
fence renders as a code block to the end. `compact` shrinks type one notch.

Edge cases checked:

- Fences: the toggle is `trim().startsWith('```')`, so an info string (```ts) opens fine; a
  fenced block containing pipe rows, headings, or bullets is untouched (the code branch is first);
  EOF inside a fence emits the block (L163, per SPEC).
- Table state machine: pipe rows buffer; anything else (or EOF) flushes. A list before a table
  flushes at the first pipe row; the paragraph path flushes the table before matching headings/
  lists, so ordering can't interleave blocks. Extra body cells beyond the header are dropped and
  short rows padded with '' (SPEC promises padding; dropping extras matches GFM).
- Security: label/href pairs only from the http(s)-anchored regexes; React escapes all text;
  `javascript:` and relative targets never form an anchor (test-pinned).
- Inline pass: single regex alternation left-to-right, non-overlapping, code first so backticked
  URLs stay literal (test-pinned). Known, acceptable fidelity gaps (not promised by the SPEC, so
  not reported as bugs): `*` used as multiplication can read as italic (CommonMark's flanking
  rules are not implemented), a trailing `.`/`,` after a bare URL is swallowed into the link,
  nested emphasis (`**a *b* c**`) mis-parses, and `***bold-italic***` renders as `*<strong>…`.
- Keys: one monotonically increasing `key` across blocks; per-`inline` keys local to their
  parent. Stable per render (pure function of text). Correct.

The one contradiction found is in the table separator's definition — see Bugs.

## Functions (low-level)

- `Markdown({text, compact})`: wrapper div + `renderBlocks`. Correct.
- `codeBlock(lines, key)`: single definition used for closed and EOF-truncated fences, so the two
  cannot drift (per its comment). Correct.
- `tableCells(row)`: trim, split on `|`, drop empty outer cells, trim cells. `| a | b |` →
  `['a','b']`; `a | b` (no outer pipes) never reaches it (the row regex requires both pipes).
  Escaped `\|` unsupported — acceptable, unpromised. Correct.
- `isTableSeparator(row)`: every cell must match `/^:?-{3,}:?$/`. Verdict: bug found (below) —
  the mandatory 3 dashes reject GFM-valid separators including the function's own doc-comment
  example `:-:`.
- `renderBlocks(text, compact)`: the line loop described above. Blank lines flush lists (two
  lists separated by a blank render as two `<ul>`s) and emit nothing. Heading sizes arrays have
  exactly 6 entries for levels 1-6. Task checkbox is `readOnly` + `checked` (display-only per
  SPEC). Correct except via `isTableSeparator`.
- `link(href, label, key)`: `target="_blank" rel="noreferrer"`. Correct.
- `inline(text)`: alternation `` `code` ``, `[t](http…)`, `**b**`, `*i*`, bare URL; the `[`
  branch re-parses with the anchored equivalent (always succeeds; the fallback text path is
  unreachable but harmless). Trailing text after the last token appended. Correct.

## Bugs found

1. `L40`: `isTableSeparator` requires at least three dashes per cell (`/^:?-{3,}:?$/`), but GFM
   defines the delimiter cell as one-or-more dashes with optional colons — the function's own doc
   comment (L38) even gives `| --- | :-: |` as the canonical example, and `:-:` fails the regex
   (probe: `/^:?-{3,}:?$/.test(':-:') === false`, likewise `--`, `-`, `:--:`). Scenario: an agent
   writes a perfectly valid table `| a | b |\n| :-: | -- |\n| 1 | 2 |` — the separator row is not
   recognised, so the whole run renders as three prose paragraphs of raw pipes, exactly the #869
   regression the table support exists to prevent. Contradicts intent: the code's own comment,
   the SPEC's "a run of pipe rows becomes a table … when the second row is the header separator
   that marks it as one" (GFM's definition of that separator), and the feature's rationale.
   Severity: minor (cosmetic, but recurring for any agent that emits short/centered separators).
   Confidence: high. Fix sketch: `/^:?-+:?$/` (one or more dashes).
