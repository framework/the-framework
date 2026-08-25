# Bug analysis: packages/framework/src/agent-archive.test.ts

## Business logic (high-level)

Tests for the per-user archive directory (#1179) plus one integration test for the install-time
gitignore (#1582). Claim-by-claim against the test SPEC:

- Email → its own directory name, trimmed/lowercased — direct assertions. Genuine.
- Hostile identities: loops `.`, `..`, `../../etc/passwd`, `.hidden`, `/absolute`, `..@evil.com`
  and asserts the two safety properties (no leading dot, no separator) plus the two exact
  anonymous fallbacks. The property-based loop is the right shape: it pins the invariant, not
  the incidental mapping. Genuine.
- Missing/blank/oversized identity → anonymous. Genuine.
- Read-once caching: injected `GitRunner` counts calls; two `resolveUserDir('/repo')` calls, one
  git read. `forgetUserDirs()` first, so ordering with the other cache test cannot interfere
  (node:test runs tests in-file sequentially; both tests reset first — clean).
- Throwing git → anonymous, no throw. Genuine.
- The real-git test builds a temp repo, writes `frameworkGitignore()` into `.the-framework/`,
  creates the transient archive/live log/branch checkout files, and asserts `git status
  --porcelain -uall` hides all three while listing `.the-framework/.gitignore` itself. The
  assertion wording ("the one tracked thing") is loose — the file is *untracked but not ignored*
  (`?? .the-framework/.gitignore`) — but the check (`status.includes(...)`) verifies exactly the
  intended visible-vs-ignored split, so the test verifies what the SPEC claims. Cleanup in
  `finally` with `rm -rf`. Requires a `git` binary and permits temp-dir git config — matches how
  the rest of the suite runs (run-tests.mjs isolates XDG, and `git init` here is self-contained
  with its own user.email/name set).

One robustness note: the porcelain-substring assertions depend on git listing the untracked
*directory* as `.the-framework/agents/` only if it were unignored — with `-uall` git lists
files, not dirs, so the negative `!status.includes('.the-framework/agents/')` still matches any
file path under it. Sound.

## Functions (low-level)

- `git(...args)` helper (last test) — execFileSync wrapper, throws on failure → test fails
  loudly. Correct.
- All tests await their async bodies; no floating promises; no test can pass vacuously (each
  negative has a paired positive in the same status string).

## Bugs found

None found.
