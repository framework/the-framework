# Bug analysis: packages/framework/src/closing-keywords.test.ts

## Business logic (high-level)

Pins `defuseClosingKeywords` (#1567) against the behaviors the SPEC names: the original #1560
sentence keeps its words and loses its effect; all nine keywords are defused in lower and upper
case; the reference itself is never backticked or rewritten (Rom's #1612 point — the mention must
stay live on the issue's timeline); the cross-repo `owner/repo#123` form is defused; a bare
reference and a keyword-suffixed word (`enclose`) are untouched; a reference already inside
backticks (`` `close #42` ``) is untouched; and the function is idempotent across multiple
phrases.

The tests genuinely verify what they claim — each asserts exact output strings (or exact
non-mutation), so none can pass vacuously.

Coverage gaps (which are where the source bugs live, see
`closing-keywords.BUG-ANALYSIS.md`):

- **No test for the colon form** (`Fixes: #10`) that GitHub's own docs list as accepted grammar
  ("The keywords can be followed by colons"). The suite's "every keyword form GitHub accepts is
  defused, whatever the case" title claims full grammar coverage but only exercises the
  space-separated form — the one form the implementation handles. The colon form passes through
  undefused today.
- The backtick test only covers the ref-flush-against-backtick shape; a closing phrase mid code
  span (`` `git commit -m "fix #42 properly"` ``) or inside a fence is rewritten and untested.
- Mixed case beyond all-upper (e.g. `Fixes`) is implicitly covered by the `i` flag but only
  lower/upper are asserted — fine.

## Functions (low-level)

- **test "the phrase that closed #1164 ..."** — exact before/after strings including the em dash
  and the backticked `queued` (which must survive untouched). Verifies both the insertion point
  and the non-mutation of the rest. Correct.
- **test "every keyword form ... whatever the case"** — loops the nine keywords, lower and upper,
  asserting exact output with the keyword's case preserved. The per-iteration message names the
  keyword. Correct (though the title overstates: "every keyword form GitHub accepts" is not the
  colon form — see coverage gap above).
- **test "the reference itself is never rewritten"** — asserts no backtick appears and `#1164`
  still stands as its own token. Correct.
- **test "the cross-repo form"** — `fixes gemstack-land/the-framework#7` → filler inserted, slug
  untouched. Correct.
- **test "an issue mentioned without a keyword"** — pure references untouched. Correct.
- **test "a word that merely ends in a keyword"** — `enclose #42` untouched. Correct.
- **test "a reference already inside backticks"** — `` write `close #42` to close it `` untouched;
  note the trailing "to close it" also proves a keyword with no following reference is inert.
  Correct for the narrow shape it covers.
- **test "running it twice changes nothing"** — idempotency over two phrases, plus the exact
  once-defused string. Correct.

## Bugs found

None found in the tests themselves. (The colon-form and code-span coverage gaps are recorded
above; the corresponding source defects are attributed to `closing-keywords.ts`.)
