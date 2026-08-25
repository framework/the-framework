# Bug analysis: packages/framework/src/closing-keywords.ts

## Business logic (high-level)

Defuses GitHub's issue-closing grammar in a plan agent's PR title/description (#1567): a merged PR
whose text says `close #1164` closes that issue, which is wrong when the PR lands only a plan
(#1560 closed #1164 and the next tickets sync deleted the ticket and its fresh plan). The cure is
to break the keyword→reference adjacency by inserting "the ticket", leaving the words and the
clickable, cross-referencing reference intact. Requirements per `closing-keywords.SPEC.md`:

- cover **every** closing keyword form GitHub accepts (close/fix/resolve, each tense/plural, any
  case) followed **directly** by a reference, including cross-repo `owner/repo#123`;
- never rewrite the reference itself;
- leave a reference already inside backticks alone (a code sample GitHub does not act on);
- ignore a keyword-suffixed word (`enclose`) and a bare reference;
- be idempotent.

The stakes are asymmetric: over-defusing costs a slightly odd sentence; under-defusing closes a
live issue on merge — the exact incident the module exists to prevent. So any reachable form of
GitHub's grammar the regex misses is a real failure, and I verified GitHub's grammar against its
own documentation ("Linking a pull request to an issue"): the docs state **"The keywords can be
followed by colons"**, with the explicit examples `Closes: #10`, `CLOSES #10`, `CLOSES: #10`. The
regex requires `\s+` between keyword and reference, so the colon form rides through undefused —
see Bugs #1 (probed: `defuseClosingKeywords('Fixes: #1164')` returns the input unchanged).

The backtick handling is an adjacency approximation, not a span parser: it skips a match whose
reference is *immediately* followed by a backtick and refuses to start a keyword right after one,
which handles `` `close #42` `` exactly — but a closing phrase in the middle of a longer code span
or fenced block is still rewritten, mutating a code sample (see Bugs #2, probed).

Concurrency/ordering: pure string function, no state; `g`-flagged `String.replace` handles
multiple phrases left to right without overlap issues (verified: `fixes #9 and closes #10` both
defused). Idempotency holds by construction (after the rewrite the keyword is followed by the
filler, which is not a reference).

## Functions (low-level)

- **`CLOSING_KEYWORDS`** — matches GitHub's documented list exactly (close/closes/closed,
  fix/fixes/fixed, resolve/resolves/resolved). Correct.
- **`FILLER`** — `'the ticket'`; contains no keyword and no reference, so it can never create a
  new closing adjacency. Correct.
- **`CLOSING_PHRASE`** — `(^|[^\`\w])(kw)(\s+)((?:[\w.-]+\/[\w.-]+)?#\d+)(?!\`)`, flags `gi`.
  - Left guard `(^|[^\`\w])`: blocks `enclose #42` (word char) and a keyword glued to a backtick.
    Correct for those cases.
  - Alternation order (`close` before `closes`) is safe: the mandatory `\s+` forces backtracking
    into the longer alternative (probed: `closes #42`, `CLOSES #42` both defused).
  - `(\s+)` — the gap. Misses GitHub's documented optional colon (`Closes: #10`) → Bugs #1.
    Includes newlines, so `fix\n#42` is defused — over-defusing, harmless.
  - Reference `(?:[\w.-]+\/[\w.-]+)?#\d+` — same-repo and cross-repo forms. Does not cover a full
    issue URL (`closes https://github.com/o/r/issues/123` untouched — probed); GitHub's docs
    syntax table lists only the `#N` and `OWNER/REPO#N` forms, so this is at most a
    beyond-documented-grammar gap → noted as Bugs #3, low confidence.
  - Right guard `(?!\`)` — skips exactly the ref-flush-against-closing-backtick case; anything
    else inside backticks is rewritten → Bugs #2.
- **`defuseClosingKeywords(text)`** — replace with `before + keyword + gap + FILLER + ' ' + ref`;
  preserves case and original whitespace, reference untouched, idempotent. Empty string → empty
  string. Correct for everything the regex matches.

## Bugs found

1. **L36–39: the colon form GitHub documents (`Fixes: #1164`) is not defused.** GitHub's own
   "Linking a pull request to an issue" page states "The keywords can be followed by colons",
   examples `Closes: #10` / `CLOSES: #10`. The regex's `(\s+)` gap cannot match `: `, so
   `defuseClosingKeywords('Fixes: #1164')` returns its input unchanged (probed). Concrete
   scenario: a plan agent writes the very common PR-description convention "Fixes: #1164" in its
   `open-pr` block; `cli.ts` defuses the title/description, misses the phrase, and merging the
   plan closes the issue with the work still undone — precisely the #1560 incident this module
   exists to prevent, and a direct contradiction of the SPEC's "any closing keyword GitHub
   accepts ... followed directly by an issue reference". Severity: major. Fix sketch: widen the
   gap to `(\s*:\s*|\s+)` (or `(:?\s+|\s*:\s*)`) so a colon (with or without surrounding spaces)
   counts as adjacency; the replacement keeps working since the captured gap is re-emitted
   verbatim before the filler.
2. **L36–39 (`(?!\`)` guard): a closing phrase inside a longer code span or fenced block is
   rewritten, corrupting the code sample.** The guard only skips a reference immediately followed
   by a backtick, so `` run `git commit -m "fix #42 properly"` first `` becomes `...fix the
   ticket #42 properly...` (probed), and a ```` ``` ```` fence containing `fix #42 in the sample`
   is likewise mutated. GitHub takes no action on references inside code spans/fences, so the
   rewrite is pure damage there, and it contradicts the module's own comment and the SPEC ("a
   reference already inside backticks is a code sample ... left alone"). Severity: minor (wrong
   direction is cosmetic, not issue-closing; needs a code sample in a plan PR body). Fix sketch:
   split the text on code spans/fences (`` `...` ``, ```` ```...``` ````) and run the replacement
   only on the non-code segments.
3. **L37 (reference alternatives): a full issue URL after a keyword is not defused**
   (`closes https://github.com/o/r/issues/123` untouched — probed). GitHub's docs syntax table
   lists only `#N` / `OWNER/REPO#N`, so this may be outside the documented grammar, but GitHub is
   commonly reported to link-and-close on the URL form too; if it does, a plan PR phrasing the
   reference as a URL closes the issue on merge. Severity: minor; confidence: low (grammar
   coverage unverified). Fix sketch: add
   `https?://github\.com/[\w.-]+/[\w.-]+/issues/\d+` as a third reference alternative.
