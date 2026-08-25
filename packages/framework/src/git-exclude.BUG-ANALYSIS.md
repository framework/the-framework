# Bug analysis: packages/framework/src/git-exclude.ts

## Business logic (high-level)

One function: append an ignore rule to the repo's `info/exclude` — git's own private ignore list — so no tracked file changes. Checked against `git-exclude.SPEC.md`: no tracked file touched (writes only under the git dir), recorded once for the whole repo covering every worktree (uses `--git-common-dir`, with the comment correctly noting a per-worktree `info/exclude` would be silently ignored), idempotent (line-match check before append).

Edge cases walked:

- **Relative vs absolute common dir**: `rev-parse --git-common-dir` yields `.git` in a main worktree (relative to the cwd the runner uses, which is `repo`) and typically an absolute path from a linked worktree; `isAbsolute` branches correctly for both.
- **Non-repo / unwritable**: `git` rejects → propagates, matching the doc ("callers decide"); both real callers (`data-branch.ts:162-163` `.catch(() => {})`, `branch-links.ts`) treat it as non-fatal.
- **Empty output**: `if (!common) return` silently no-ops — unreachable in practice (rev-parse either errors or prints a path), harmless.
- **Missing exclude file**: `fs.read(path).catch(() => '')` treats *any* read error as empty, then `mkdir` (recursive, per `node-fs.ts`) before append. A permission-denied read therefore leads to an append attempt that fails and propagates — acceptable, same "callers decide" contract.
- **Newline handling**: prefixes `\n` only when the existing content is non-empty and lacks a trailing newline, so a rule is never glued onto the previous line. Appends `rule + '\n'`. Correct.
- **Idempotence check**: `line.trim() === rule` — tolerant of surrounding whitespace in the file; rules passed by callers (`/tickets`, `!/tickets/`, branch-link names) contain no leading/trailing whitespace, so no false negative. A rule that is a *prefix* of an existing longer rule is correctly not treated as present (exact match).
- **Concurrency**: two processes appending simultaneously could each miss the other's rule and both append — producing a duplicated line, which git treats identically (the dedup is cosmetic). Callers invoke this at activation/setup, not in hot concurrent paths. Not a bug.

## Functions (low-level)

- **`excludeFromGit(repo, rule, fs, git)`** — described above. Inputs: repo path (from the CLI's project root), a literal gitignore pattern. Output: none; rejects on git/write failure. Also note `mkdir(infoDir)` runs even when the file already existed — recursive mkdir on an existing dir is a no-op, fine. Verdict: correct.

## Bugs found

None found.
