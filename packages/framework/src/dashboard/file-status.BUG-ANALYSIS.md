# Bug analysis: packages/framework/src/dashboard/file-status.ts

## Business logic (high-level)

One `git status --porcelain` read turned into `path -> 'untracked' | 'modified' | 'deleted'`, which
is what dots the entries in the panel's file tree (#492). The state names match the animate-ui
`Files` component's `gitStatus` values, so this module is the adapter between git's two-column
porcelain codes and that vocabulary.

Design points that hold:

- **One git call for the whole tree**, not one per file. The tree can have hundreds of entries.
- **Forgiving**: a non-repo, a missing git, any failure at all resolves `{}` rather than throwing, so
  the panel renders an undotted tree instead of an error.
- **The parser is shared**, not copied: `agent-handoff.ts:364` uses `parsePorcelain` for its
  pending-files read (#1173). That is the right call — the porcelain grammar is fiddly enough that
  two copies would drift, which is the failure this repo has already had elsewhere (see
  `parseNumstat`'s comment in `file-diff.ts`).

**Mapping semantics.** `??` → untracked; a `D` in either column → deleted; everything else (M, A, R,
C, T, U, and the second column of a staged-plus-modified pair) → modified. That collapse is
deliberate and matches what a file tree can express with three dots.

**A conflicted file** (`UU`, `AA`, `DU`, `UD`) is worth naming: `DU`/`UD` contain a `D` and therefore
read as *deleted* even though the file is present and in conflict, while `UU`/`AA` read as modified.
Odd but harmless for a dot, and merge conflicts do not arise inside an agent's own worktree in this
system.

**Path fidelity.** `git status --porcelain` quotes and C-escapes a path when `core.quotePath` is on
(the default) and the name has non-ASCII or special characters. `unquotePath` strips the surrounding
quotes but, as its own comment says, leaves the `\303\251` escapes in place — so a file named
`café.ts` produces the key `caf\303\251.ts`, which matches nothing the tree asked about and simply
goes undotted. The limitation is acknowledged in the code and the consequence is a missing dot, not a
wrong action, so it is recorded here rather than reported.

## Functions (low-level)

### `unquotePath(path)` (L11-13)

Strips a leading and trailing `"` when both are present and the string is at least 2 chars.

- `'"a b.ts"'` → `'a b.ts'`. (git does not quote for a plain space, but the case is handled.)
- `'a.ts'` → unchanged.
- `'"'` (length 1) → unchanged, since the length guard prevents `slice(1, -1)` returning `''`.
- `'""'` → `''`, which the caller then drops via `if (!path) continue`. Correct.
- Escapes inside are left as-is — documented.

*Verdict:* correct within its stated scope.

### `parsePorcelain(out)` (L23-36)

*Input:* raw porcelain v1 text. *Output:* `{ code, path }[]`.

- `line.length < 4` skips the trailing empty line from the final `\n`, and any truncated line. The
  shortest real line is `XY p` = 4 chars, so the bound is right, not off by one.
- `code = line.slice(0, 2)`, `path = line.slice(3)` — porcelain v1 is `XY<space>PATH`, so this is
  correct, including for `??` (two literal question marks).
- **Rename**: `' -> '` splits the old from the new path, and the new one is kept — correct, since
  that is the path that exists on disk and the one the tree lists.
- A file whose *name* literally contains `' -> '` would be mis-split. git quotes such a name only if
  it also has non-ASCII/control characters, so a plain `a -> b.txt` would indeed be truncated to
  `b.txt`. Not a case that occurs in this system; recorded, not reported.
- Empty path after unquoting → skipped.
- Duplicate paths cannot occur: porcelain emits one line per path.

*Verdict:* correct.

### `readFileStatuses(cwd, git)` (L43-49)

- **git fails** → `''` → `parsePorcelain('')` → `[]` → `{}`. Correct, and pinned by
  `file-status.test.ts:19`.
- **Clean tree** → `''` → `{}`. Correct.
- `code === '??'` before the `D` test, so an untracked file is never mistaken for deleted.
- `code.includes('D')` covers `' D'`, `'D '`, `'DD'`, and also `'AD'`/`'RD'` (staged add/rename then
  deleted in the worktree) — all genuinely gone from disk. Correct.
- `map[path] = …` last-write-wins; irrelevant given unique paths.
- Returns a plain object, so a path literally named `__proto__` would be an own property assignment
  on an object literal — `{}` has `__proto__` as an accessor on `Object.prototype`, so
  `map['__proto__'] = 'modified'` would set the prototype rather than a key and silently drop the
  entry (and, since the value is a string, `Object.setPrototypeOf` ignores it). A file named exactly
  `__proto__` at the repo root does not occur here; recorded, not reported.

*Verdict:* correct.

## Bugs found

None found.
