# Bug analysis: packages/framework/src/dashboard/file-diff.ts

## Business logic (high-level)

Two reads over whatever checkout the caller resolved (#815 — an agent's view must show its own
worktree, never the project root):

- **`readFileDiff`** — one changed file's patch, for the tree's hover card (#816) and the agent
  view's Changes section (#817). Tracked files diff against `HEAD` (not the index), matching the
  `git status --porcelain` read that dotted the file in the first place, with a fallback to the plain
  working-tree diff for a repo with no commits yet. Untracked files have no blob to diff against, so
  their contents are rendered as an all-added patch — deliberately *not* via `git diff --no-index`,
  which exits non-zero on a difference and would read as a failure.
- **`readFileChanges`** — the whole changed-file list with per-file counts, from one `git status`
  (already done by the caller) plus one `git diff --numstat`. Two git calls however many files
  changed, which is the point.

**Path safety.** `safeRepoPath` (re-exported from `file-read.ts`) is the only way in, applied before
any git call or read, and `readFileChanges` filters its whole input through it. The untracked branch
goes through `readConfinedFile`, so it inherits the symlink containment too — pinned by
`file-diff.test.ts:156`.

**Capping.** Both the tracked and untracked patch bodies go through `cutToPreview` (500 lines). The
counts, however, are computed *from the already-cut patch*, which is where the untracked path
diverges from what the SPEC promises for `readFileChanges` (see Bugs found #1).

**Counting.** `countChanges` walks the patch counting `+`/`-` prefixed lines and skipping the
`---`/`+++` file headers. Skipping by prefix rather than by position also skips *content* lines that
happen to begin with `--` or `++` (see Bugs found #2).

**Ordering/concurrency.** `readFileChanges` fans out with `Promise.all` over the untracked files
(each one a confined read), then sorts by path so a live agent's edits do not reshuffle the list.
The sort is `localeCompare`, which is locale-dependent but stable within a process — fine, since the
list is rebuilt per render.

## Functions (low-level)

### `hunksOnly(patch)` (L43-47)

Finds the first line starting with `'--- '` or `'@@'` and keeps everything from there, `trimEnd`-ed.

- A normal patch starts `diff --git` / `index` → the `--- a/path` header is found. Correct.
- A new tracked file: `--- /dev/null` still matches `'--- '`. Correct.
- A pure mode change (`old mode` / `new mode`, no hunks) → `start === -1` → `''` → the caller returns
  `null`. Correct: nothing to render.
- Cannot be tripped by a content line, because content lines only appear *after* the header it finds.
- `'--- '` requires the trailing space, so a removed line rendered as `---foo` (no space) does not
  match — but a removed line whose content is `-- foo` renders as `--- foo`, which *would* match. It
  cannot matter here: such a line only exists after the real header, and `findIndex` takes the first.

*Verdict:* correct.

### `countChanges(patch)` (L50-59)

Counts `+`/`-` lines, skipping anything starting with `+++` or `---`.

The skip is meant for the two file headers. It also silently drops content lines: a removed source
line beginning with `--` becomes a diff line beginning with `---`, and an added source line beginning
with `++` becomes `+++`. Verified:

```
--- a/a.md / +++ b/a.md / @@ / "----" / "-title: x"   →  { added: 0, removed: 1 }   (should be 2)
--- a/a.c  / +++ b/a.c  / @@ / "-++i;" / "+++j;"       →  { added: 0, removed: 1 }   (added should be 1)
```

*Verdict:* bug found (#2).

### `asAllAdded(text)` (L62-66)

Prefixes every line with `+` and drops the artificial last empty element produced by a trailing
newline. An empty file yields `''` (one empty line, popped, `[].join` → `''`), which then makes
`countChanges` return 0/0 — an untracked empty file therefore shows as a 0-line addition rather than
`null`. Reasonable. A file with no trailing newline keeps its last line. *Verdict:* correct.

### `readFileDiff(cwd, path, status, git)` (L78-105)

*Output:* `FileDiff | null`.

- **Unsafe path** → `null` before git or disk. Correct.
- **Untracked**: confined read; `null` when outside/unreadable; NUL → `binary: true`; otherwise
  all-added, cut, counted. Correct except that the count is taken post-cut (feeds #1).
- **Tracked**: `git diff --unified=3 HEAD -- path`, falling back to `git diff --unified=3 -- path` and
  then to `''`. The double `.catch` means *any* HEAD-diff failure retries without HEAD, not just the
  no-commits case — harmless, since the second form is a strictly weaker query.
- **Empty output** → `null` ("no diff to show"), so an unchanged file gets no empty card. Correct.
- **`/^Binary files /m`** → `binary: true`. The `m` flag matters: the line is preceded by the
  `diff --git` header. Correct.
- **Patch that survives `hunksOnly` as empty** → `null`. Correct.
- A path containing a `-` is safe because it is passed after `--`; a *leading* `-` is rejected by
  `safeRepoPath` anyway. Correct.
- A deleted file: `git diff HEAD -- path` produces the removal hunks. Correct.

*Verdict:* bug found (#2 via `countChanges`; #1 via the cut-then-count order).

### `parseNumstat(out)` (L122-132)

`added \t removed \t path`, with `-`/`-` for binary. Rejoins the path on tabs, which is the drift this
module was consolidated to fix.

- Empty line → `['']` → `removed === undefined` → skipped. Correct.
- Binary line `-\t-\tlogo.png` → `{ added: 0, removed: 0, binary: true }`. Correct.
- A non-numeric count → `Number(x) || 0` → 0. Correct-ish (never NaN in the payload).
- A path field containing tabs → rejoined. Correct.
- **A rename** → git writes the path field as `old => new` or `dir/{old => new}/file` (confirmed
  against this repo's own history), which matches no key the porcelain read produced. See #3.

*Verdict:* bug found (#3).

### `readFileChanges(cwd, statuses, git)` (L143-168)

- **Empty `statuses`** → `[]` with no git call. Correct (pinned at `file-diff.test.ts:149`).
- **Unsafe keys** are filtered out before git runs. Correct.
- **`git diff --numstat HEAD`** with the same double-catch fallback. Correct.
- **A tracked file with no numstat entry** (staged-only? no — `diff HEAD` covers the index; in
  practice a rename, see #3) → `{ added: 0, removed: 0 }`.
- **An untracked file** → its own confined read via `readFileDiff`, `added` from the patch, `removed`
  always 0, `binary` from the diff. Correct in shape; the count is capped (see #1).
- `readFileDiff(...).catch(() => null)` — `readFileDiff` already swallows its own failures, so this is
  belt-and-braces; harmless.
- The `Promise.all` fans out one open file handle per untracked file. A session with hundreds of new
  files would open them all at once; Node's thread pool serialises the reads, so this is bounded in
  practice.

*Verdict:* bug found (#1).

## Bugs found

1. `L90` (with `L164`): an untracked file longer than the 500-line preview cap reports its added-line
   count as 500 rather than its real length, contradicting `file-diff.SPEC.md` ("Untracked files
   appear in no diff, so their added count is their line count, read from disk"). Scenario: an agent
   creates a 1,800-line file (a new source module, a generated lockfile); the Changes list shows it as
   `+500` while a tracked file with 1,800 added lines shows `+1800` from numstat — the same session's
   list mixes real counts with capped ones. The cause is order: `cutToPreview` runs *before*
   `countChanges`, so the count is taken from the truncated patch. Severity: minor (a wrong number in
   a summary, no data loss). Confidence: high. Fix: count before cutting — build
   `const all = asAllAdded(...)`, take `countChanges(all)` for the counts, and cut only what goes into
   `patch`.

2. `L54`: `countChanges` skips content lines whose text begins with `--` or `++`, undercounting the
   diff stats. Scenario: an agent deletes the `---` front-matter separator from a Markdown file, or a
   `-- comment` line from SQL/Lua/Haskell; the diff line is `----` / `--- comment`, both of which start
   with `---`, so `removed` is one lower than the lines actually removed. Symmetrically an added line
   starting with `++` (e.g. `++i;`) is not counted in `added`. Confirmed by running the function
   directly: `"----"` plus `"-title: x"` yields `{added: 0, removed: 1}` where 2 is right. This
   contradicts the field's meaning in `FileDiff`/`FileChange` and the SPEC's "carries added/removed
   line counts". Severity: minor. Confidence: high. Fix: the two headers are the first two lines of
   the body, not "any line with this prefix" — skip them positionally (they are exactly the lines
   before the first `@@`), or count only lines after the first `@@` line.

3. `L154` (with `L161`): a staged rename shows `+0/-0` in the Changes list even when its contents
   changed. Scenario: an agent runs `git mv a.ts b.ts`, edits `b.ts`, and stages both;
   `git status --porcelain` reports `RM a.ts -> b.ts`, which `parsePorcelain` maps to the key `b.ts`,
   while `git diff --numstat HEAD` writes the rename's path field as `a.ts => b.ts` (or
   `dir/{a => b}.ts`) — verified against this repo's own `git log --numstat` output. The keys never
   match, so `counted.get('b.ts')` misses and the file falls to the `added: 0, removed: 0` branch at
   L161. Severity: minor (wrong counts in a summary). Confidence: low — it needs a rename that is
   staged but not yet committed, which is a narrow window in this workflow. Fix: pass `--no-renames`
   to the numstat call so git emits a plain delete + add pair whose paths match the porcelain keys.
