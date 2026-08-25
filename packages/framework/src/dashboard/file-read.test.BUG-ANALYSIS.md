# Bug analysis: packages/framework/src/dashboard/file-read.test.ts

## Business logic (high-level)

Eight tests over the unchanged-file preview (#828) and its shared path guard. Every test that reads
uses a real temp directory and real files — right, because the behaviours under test (`realpath`
containment, symlink resolution, NUL detection, trailing-newline handling) are properties of the
filesystem, not of a fake.

What is pinned:

- Contents come back with the trailing newline removed (so no phantom blank last line).
- A file past the preview cap is cut and says so, at exactly `MAX_PREVIEW_LINES` lines.
- A file with a NUL byte reports `binary: true` and an empty body rather than dumping bytes.
- An **empty** file yields an empty body, not `null` — the case a `Buffer`-vs-string mix-up would
  break.
- Traversal, absolute paths and `.git` are refused.
- A symlink out of the checkout is refused *after* passing the syntactic guard — the test that
  justifies the `realpath` layer existing at all.
- A missing file is `null`.
- `safeRepoPath`'s rejection table.

**Do the tests verify what they claim?** Yes. Four of them use `deepEqual` on the *whole* result
object rather than probing one field, so an extra or altered field fails them. The symlink test is
the strongest: its comment states the reason ("the string guard passes here"), and it would pass
trivially if the guard were the only layer — which is why it writes a real file outside and a real
symlink to it.

**Hygiene note (not a bug).** No test removes its temp directory; `docs.test.ts` and
`file-diff.test.ts` differ here. Leftover `os.tmpdir()/file-read-*` directories are harmless and the
OS reclaims them.

**Not covered:** the `path.length > 1024` and `'a/./b'` rejections; a symlink pointing *inside* the
checkout (which must be allowed); a directory passed as the path; and a case-variant `.GIT/config`,
which is the gap that lets the defect recorded in `file-read.BUG-ANALYSIS.md` survive. Coverage gaps,
reported against the source.

## Functions (low-level)

### `scratch()` (L8)

`mkdtemp` under `os.tmpdir()`. Note it does **not** call `realpath`, unlike `docs.test.ts`. That is
fine here precisely because `readConfinedFile` realpaths `cwd` itself — the macOS `/tmp` →
`/private/tmp` link is normalised on both sides of the prefix check. So the tests pass on macOS
without the fixture knowing about it, which is the behaviour the source's JSDoc claims. *Verdict:*
correct.

### `'returns the file, without its trailing newline as a blank line'` (L10)

`deepEqual` on the full `FileContent`. Would fail on a changed `path` echo, a stray `truncated`, or a
kept trailing newline. *Verdict:* correct.

### `'cuts a long file and says so'` (L17)

Writes `MAX_PREVIEW_LINES + 50` lines joined by `\n` (no trailing newline), asserts `truncated` and an
exact line count of 500. Asserting the count rather than "less than the input" is what pins the cap.
*Verdict:* correct.

### `'reports a binary file rather than rendering bytes'` (L26)

`Buffer.from([0x89, 0x50, 0x00, 0x01])` — a NUL in the middle, mirroring a PNG header. Full-object
`deepEqual`. *Verdict:* correct.

### `'yields an empty body for an empty file, not null'` (L33)

The important one: `readConfinedFile` returns a zero-length `Buffer`, and `if (!raw)` must not treat
it as failure — a `Buffer` of length 0 is truthy, so it does not. This test is what stops that from
regressing into `null` if the return type were ever changed to a string. *Verdict:* correct.

### `'refuses a traversing path'` (L40)

Three spellings, each asserted `null`. Note it writes an `a.ts` first so the directory is not empty —
irrelevant to the assertions but harmless. *Verdict:* correct.

### `'refuses a symlink that points out of the checkout'` (L48)

Creates a second temp dir with a real secret, a `src/` subdirectory, and a symlink across. Asserts
`null`. This is the only test in the file that exercises the `realpath` containment layer, and it
fails if that layer is removed. *Verdict:* correct — and load-bearing.

### `'is null for a file that is not there'` (L59)

Pins that a missing file resolves `null` via the failed `realpath`, not via a thrown ENOENT.
*Verdict:* correct.

### `'safeRepoPath still rejects everything that is not a plain repo-relative path'` (L64)

One positive plus a seven-entry rejection table, each with a `JSON.stringify`'d failure message so a
regression names the offending input. Synchronous. *Verdict:* correct.

## Bugs found

None found.
