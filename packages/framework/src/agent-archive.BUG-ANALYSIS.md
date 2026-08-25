# Bug analysis: packages/framework/src/agent-archive.ts

## Business logic (high-level)

Decides the per-user directory a project's agent archives are filed under on the data branch
(#1179/#1582). The one property that must hold (SPEC): the directory name derived from
`git config user.email` — repo configuration, treated as untrusted — can never climb out of the
archive.

Verification of the sanitizer:
- `trim().toLowerCase().replace(/[^a-z0-9@._+-]/g, '-')` collapses everything outside the
  conservative set; the acceptance regex `^[a-z0-9][a-z0-9@._+-]*$` then requires a leading
  letter/digit, which rules out `.`, `..`, dotfiles, and anything that began with `/`or `\`
  (both become `-`). No output can contain a path separator (neither `/` nor `\` is in the
  allowed set), so the result is always a single path segment; an embedded `..` substring
  (e.g. `x-..-y`) is harmless inside one segment. Length is capped at 64. Anything failing falls
  to `anonymous`. All hostile cases from the test hold.
- Platform note (relied-upon, not reported): Windows reserved device names (`con`, `nul`, …) and
  trailing-dot names (`user.`) pass the regex; a git identity of literally `con` or ending in
  `.` would fail directory creation on Windows. These are not values any real `user.email`
  takes, and the failure would be loud, not corrupting.

Caching: `resolveUserDir` memoizes per `cwd` for the process's life — the SPEC explicitly blesses
this ("read once per repo", stale-after-config-change tolerated, `forgetUserDirs` as the explicit
reset). A concurrent first call races two git reads for the same cwd; both compute the same value
and the second `cache.set` is idempotent — benign. A failed git read (`.catch(() => '')`) yields
`anonymous` — and note that this *failure* is also cached, so a repo that momentarily could not
run git files under `anonymous` for the daemon's life; that is within the SPEC's "read once"
trade-off and history is never dropped, so acceptable.

## Functions (low-level)

- `userDirName(email)` — pure; handles undefined/empty/whitespace/oversized/hostile inputs as the
  tests pin. The email keeps `@._+-` so real addresses map to themselves lowercased. Verdict:
  correct.
- `resolveUserDir(cwd, git)` — cache get → `git(['config','user.email'], cwd)` → trim →
  `userDirName` → cache set. Uses the injected `GitRunner` (testable). The extra `.trim()` on the
  email before `userDirName` (which trims again) is redundant but harmless. Verdict: correct.
- `forgetUserDirs()` — clears the map; used by tests; exported for a daemon outliving a config
  change (currently no production caller — consistent with the documented "for the process's
  life" behavior, so noted, not a bug). Verdict: correct.
- `ANONYMOUS_USER_DIR`, `ARCHIVE_DIR` re-export, `MAX_USER_DIR` — constants; `anonymous` itself
  satisfies the sanitizer's shape, so consumers can join it identically. Correct.

## Bugs found

None found.
