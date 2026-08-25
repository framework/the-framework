# Bug analysis: packages/framework/src/dashboard/file-diff.test.ts

## Business logic (high-level)

Fifteen tests over `readFileDiff`, `readFileChanges`, `parseNumstat` (indirectly) and `safeRepoPath`.
Most inject a fake `GitRunner` that returns a canned patch or numstat, which is right: the parsing is
what is under test, not git. Three tests use real temp directories, for the paths that read the
filesystem (untracked contents, the symlink containment).

What is pinned, matched against `file-diff.SPEC.md`:

- A tracked file yields hunks only, with git's `diff --git`/`index` preamble dropped, and correct
  `added`/`removed`.
- Nothing to show → `null`, not an empty card.
- A binary change is flagged, not dumped.
- A long patch is cut to exactly 500 lines and marked.
- A repo with no commits falls back to the working-tree diff — and the *number of git calls* is
  asserted, so the fallback is proven to have happened rather than inferred.
- An untracked file renders as all-added **and git is never asked** (the fake throws if it is).
- `safeRepoPath`'s rejection table, and that an unsafe path is refused before any read.
- `readFileChanges` does one numstat call for many files (asserted by call count), sorts by path,
  drops unsafe paths, asks git nothing on a clean checkout, and counts an untracked file from disk.
- An untracked file reached through a symlink out of the repo is refused.

**Do the tests verify what they claim?** Yes, with several assertions strong enough to fail on the
right regressions:

- `:63` `assert.equal(calls, 2)` — the no-commits fallback is proven by counting, not by the result.
- `:69-71` and `:99-101` and `:143-145` and `:150-153` use a `git` that *throws if called*, so "never
  asks git" is a real assertion rather than a comment.
- `:118` `assert.equal(calls, 1)` pins the "two git calls however many files" property that the whole
  design of `readFileChanges` exists for.
- `:50` asserts an exact 500-line patch, so the cap cannot drift.

**The gap that matters.** Nothing here exercises the count of an untracked file *past* the preview
cap, and nothing exercises a diff whose content lines begin with `--`/`++`. Those are exactly the two
defects recorded in `file-diff.BUG-ANALYSIS.md` — the fixtures are all small and well-behaved. The
untracked count test at `:126` uses a 3-line file, far under the 500-line cap, so it cannot see the
truncation interaction.

**Hygiene note (not a bug).** The three filesystem tests do not remove their temp directories, unlike
`docs.test.ts`. Harmless.

## Functions (low-level)

### `PATCH` / `fakeGit` (L8-20)

A realistic single-file patch including the `diff --git`/`index` preamble, so `hunksOnly` has
something to strip. `fakeGit` ignores its arguments — fine for the tests that only care about output,
and the tests that care about arguments build their own runner.

### `'a modified file yields the hunks, without git's diff/index preamble'` (L22)

Five assertions: not binary, not truncated, starts at `--- a/src/a.ts`, no `diff --git`, and
`added === 2` / `removed === 1`. The comment at L30 states the intent behind the header skip. Note
this fixture's content lines are ordinary code, so it cannot detect the `---`/`++`-prefixed content
miscount. *Verdict:* correct as far as it goes.

### `'a file with no diff to show yields null'` (L33)

Empty git output → `null`. Correct.

### `'a binary change says so'` (L37)

Feeds git's actual `Binary files a/… and b/… differ` line, preceded by the `diff --git` header — which
is what makes the `m` flag on the regex necessary. *Verdict:* correct.

### `'a long patch is cut and says it was cut'` (L45)

600 `+` lines plus headers; asserts `truncated` and exactly 500 lines. Correct.

### `'a repo with no commits falls back to the working-tree diff'` (L53)

The runner throws when `HEAD` is among the args and succeeds otherwise; asserts a result *and* that
git was called twice. This is the only way to distinguish "fell back" from "the first call worked".
*Verdict:* correct.

### `'an untracked file renders as all-added from its contents, and git is never asked'` (L66)

Real temp file, a `git` that throws on any call. Asserts the exact patch text and both counts.
*Verdict:* correct.

### `'safeRepoPath rejects…'` (L79) / `'an unsafe path is refused before any read'` (L98)

A ten-entry rejection table with per-case messages, and a throwing git to prove nothing runs.
*Verdict:* correct.

### `NUMSTAT` + `'readFileChanges counts every changed file from one numstat'` (L105)

One `deepEqual` over the whole sorted result, covering a modification, a deletion and a binary — plus
the call count. Note the binary case asserts `added: 0, removed: 0, binary: true`, pinning
`parseNumstat`'s `-`/`-` handling. No rename entry appears in the fixture, which is why the rename
mismatch recorded in the source analysis is invisible here. *Verdict:* correct as far as it goes.

### `'counts an untracked file, which no diff lists'` (L126)

Real 3-line file, empty numstat. `deepEqual` on the whole entry. *Verdict:* correct.

### `'is sorted by path'` (L133)

Feeds numstat in `z, a, m` order and asserts `a, m, z`. Meaningful — an unsorted implementation would
return the `Object.keys` order, which for these keys is insertion order `z, a, m`. *Verdict:* correct.

### `'drops an unsafe path rather than passing it to git'` (L142) / `'on a clean checkout…'` (L149)

Both use throwing runners; both assert `[]`. The first also proves the filter runs before the
`paths.length === 0` short-circuit decision. *Verdict:* correct.

### `'an untracked file reached through a symlink out of the repo is refused'` (L156)

Real symlink into a second temp dir; asserts `null`. The comment states why the untracked branch
carries the containment duty. *Verdict:* correct — and load-bearing.

## Bugs found

None found.
