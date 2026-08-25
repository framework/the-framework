# Bug analysis: packages/framework/src/dashboard/file-read.ts

## Business logic (high-level)

The one place a client-supplied repo-relative path turns into bytes. Two consumers: the file tree's
hover card for an *unchanged* file (#828, `readFileContent`) and the untracked-file branch of
`file-diff.ts` (#816). Both take the path from the browser, so the guard and the confined read live
here once.

Three layers of defence, and each is load-bearing:

1. **`safeRepoPath`** — a syntactic filter: non-empty, ≤ 1024 chars, no NUL, not absolute, not a
   Windows drive path, no leading `-` (git would read it as a flag), no `.git` segment anywhere, and
   no empty / `.` / `..` segment after splitting on either separator.
2. **`realpath` on both sides** — the containment check resolves symlinks. This is the layer that
   catches `src/link.txt -> /etc/passwd`, which the syntactic filter passes cleanly. The JSDoc
   explains why `resolve` alone is not enough, and `cwd` goes through `realpath` too so the platform's
   own links (macOS `/tmp` → `/private/tmp`) do not make every read look like an escape.
3. **`startsWith(root + sep)`** — a prefix check on already-canonical paths, so `/repo-evil/x` cannot
   pass for `/repo/x` (the `+ sep` is what rules that out).

**Binary detection** is git's heuristic: a NUL byte anywhere in the buffer. Cheap and matches what
the diff side does, so a file reads the same way through both paths.

**Capping** is by line, not byte: `MAX_PREVIEW_LINES = 500`. The cut is applied *after* the whole
file is read into memory — the cap is on what the card renders, not on what is read. For a hover
card over a repo file that is acceptable; a genuinely huge file makes `readFile` reject
(`ERR_FS_FILE_TOO_LARGE` past ~2 GiB) and the `.catch(() => null)` turns it into "nothing to show".

**Ordering/concurrency:** none — every call is independent and stateless. The dynamic `import()`s
inside `readConfinedFile` are module-cached after the first call.

**Where the guard is weaker than it reads.** `parts.includes('.git')` is a case-sensitive comparison,
while the filesystems this daemon runs on (macOS APFS, Windows NTFS) are case-*insensitive* by
default. See Bugs found #1.

## Functions (low-level)

### `safeRepoPath(path)` (L25-32)

*Input:* an arbitrary client string. *Output:* boolean.

- `''` → false (the `!path` guard). `'a'.repeat(1025)` → false. `'a\0b'` → false.
- `'/etc/passwd'`, `'C:\\win.ini'`, `'--output=/tmp/x'` → false.
- `'src/../../outside.ts'` → split yields a `..` segment → false. Note it rejects `..` *anywhere*, not
  just leading, so `a/../b` (harmless) is rejected too — deliberately strict, and the right trade for
  a guard.
- `'src//a.ts'` → an empty segment → false.
- `'.git/config'`, `'.git\\config'`, `'a/.git/config'` → false (any `.git` segment, which the comment
  motivates: a nested repo's `.git/config` holds credentials too).
- `'src/a.ts'`, `'a.ts'` → true.
- A trailing separator (`'src/'`) → empty final segment → false.
- A path made only of separators → false.
- `'.gitignore'` → true (correct — the segment is not `.git`).
- **`'.GIT/config'` → true.** The only case-sensitivity in the whole guard, and the one that matters.

*Verdict:* bug found (see #1).

### `readConfinedFile(cwd, path)` (L44-54)

*Input:* a checkout root and a relative path. *Output:* `Buffer | null`.

- Unsafe path → `null` before any I/O. Correct — no `realpath` on hostile input either.
- `cwd` itself missing → `realpath` rejects → `null`.
- Target missing → `realpath` rejects → `null`, which doubles as the "not there" answer and avoids a
  separate `stat`. Correct and pinned by `file-read.test.ts:59`.
- Target is a symlink pointing outside → `full` resolves outside `root` → `null`. Pinned by
  `file-read.test.ts:48`.
- Target is a symlink pointing *inside* → resolves under `root` → allowed. Correct.
- An intermediate directory that is a symlink outside → `realpath` resolves the whole chain, so it is
  caught too.
- `full === root` (i.e. `path` resolving to the checkout root) cannot happen, since every safe path
  has at least one non-empty, non-`.` segment; and the `root + sep` prefix would reject it anyway.
- Read failure (EACCES, EISDIR, too large) → `null`.
- TOCTOU: the file could be replaced by a symlink between `realpath` and `readFile`. The attacker
  would need write access to the checkout, which is the same trust level as the daemon itself. Not a
  real exposure here.

*Verdict:* correct, given a case-sensitive filesystem (see #1 for the other case).

### `cutToPreview(body)` (L57-61)

Splits on `\n`, returns the first 500 lines joined, and whether anything was dropped.

- A body with exactly 500 lines → `truncated: false`, untouched. Boundary is `<=`, so correct.
- 501 lines → cut to 500, `truncated: true`.
- CRLF text → the `\r` stays on each line; line counting is still right.
- A single 10 MB line with no `\n` → one line, not truncated, returned whole. The cap is per line
  count only; this is the honest reading of "preview lines" and no consumer breaks on it.
- Empty string → `['']`, one line, untouched.

*Verdict:* correct.

### `readFileContent(cwd, path)` (L68-73)

- Unsafe / outside / unreadable / missing → `null` (via `readConfinedFile`). Correct.
- A file containing a NUL → `{ text: '', binary: true }` with `truncated: false`. Correct.
- An **empty** file → `readConfinedFile` returns a zero-length `Buffer`, which is **truthy** in JS, so
  it is not mistaken for `null`; the result is `{ text: '', truncated: false, binary: false }`. This
  is the subtle case, and `file-read.test.ts:33` pins it explicitly — worth noting because
  `if (!raw)` would have been wrong if it had been written against a string.
- Exactly one trailing newline is stripped (`/\n$/`), so a file ending in `\n` does not render a blank
  final line. Two trailing newlines leave one blank line, which is the honest rendering.
- Non-UTF-8 bytes with no NUL (Latin-1 text) → `toString('utf8')` yields U+FFFD replacements rather
  than `binary: true`. That is git's heuristic exactly, and the interface comment says as much.

*Verdict:* correct.

## Bugs found

1. `L30`: the `.git` exclusion is case-sensitive, so on a case-insensitive filesystem a client can
   read the repository's git config through a case variant. `safeRepoPath` rejects a path only when a
   segment equals `.git` exactly; `'.GIT/config'` (or `'.Git/config'`) passes, and on macOS APFS /
   Windows NTFS — both default to case-insensitive, and this file's own JSDoc notes macOS as a
   supported platform — `realpath(resolve(cwd, '.GIT/config'))` resolves to a path *inside* the
   checkout, so the containment check passes and `readFileContent` returns the repo's `.git/config`.
   That file routinely holds credentials (`url.https://x-access-token:<token>@github.com/...` after a
   `gh` clone), which is precisely what the comment at L29 says the check exists to protect. The
   entry point is the dashboard's file-contents RPC, whose path argument comes from the browser.
   Severity: minor (the RPC surface is same-origin guarded, so this is defence-in-depth being
   defeated rather than a direct remote read; and it is inert on Linux). Confidence: medium — the
   guard is provably case-sensitive, the exploitability depends on the viewer's filesystem.
   Fix: compare case-insensitively, e.g.
   `if (parts.some(part => part.toLowerCase() === '.git')) return false`.
