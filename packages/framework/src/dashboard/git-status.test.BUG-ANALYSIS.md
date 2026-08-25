# Bug analysis: packages/framework/src/dashboard/git-status.test.ts

## Business logic (high-level)

Seven tests over `readGitStatus`, all with injected seams so nothing touches git, `gh` or the
process-wide cache. That last point matters: `cachedPrView`/`cachedPrsForBranch` hold module-level
state, so a test that fell through to them would couple to whatever another test left behind. Every
test here passes either `pr` or `prs`, so none does.

What is pinned:

- Branch and clean tree, with no PR.
- A dirty tree (non-empty porcelain) plus a linked PR, including the PR object passing through
  unchanged.
- Not a git repo → `undefined`.
- A failing PR lookup degrades to no PR rather than failing the row.
- The #1255 behaviour in three parts: a predecessor's merged PR on a reused pinned branch is *not*
  worn; the run's own PR (merged after it started, or simply open) *is*; and a failing history read
  degrades to no PR and no `prPending`.

**Do the tests verify what they claim?** Yes, and three assertions are stronger than they look:

- `:16` and `:22` use `deepEqual` on the *whole* status object. Because the source emits `pr` and
  `prPending` via conditional spreads, a regression that set `pr: undefined` explicitly would fail
  these — which is exactly the distinction the payload cares about.
- `:45` is the regression test for the real bug: `prs` returns only a merged PR created *before*
  `since`, and the assertion is `status?.pr === undefined`. Under the old `gh pr view` behaviour this
  would have been the merged PR, so the test discriminates.
- `:86` asserts `prPending === undefined` alongside `pr === undefined`. Without it, a regression that
  reported a failed lookup as "still loading" would pass — and the UI would offer no "Open PR" button
  forever.

**Fixture accuracy.** `gitWith` answers `rev-parse` with a trailing `\n`, so the `.trim()` in the
source is genuinely exercised (`branch: 'main'`, not `'main\n'`). The dirty fixture is `' M src/a.ts\n'`,
which also exercises the trim-then-length check rather than a bare length check on the raw output.

**Not covered** (gaps, not defects): the `pending: true` path — no test asserts that a cache miss
surfaces `prPending: true`, because every test injects a seam that bypasses the cache; a failing
`git status` (the `.catch(() => '')` branch); and the precedence of `deps.pr` over `deps.since`.

## Functions (low-level)

### `gitWith(branch, porcelain)` (L6-12)

Dispatches on `args[0]`: `rev-parse` → the branch with a newline, `status` → the porcelain text,
anything else → `''`. Realistic enough that both source reads behave as they would against real git.
*Verdict:* correct.

### `'reports branch, clean tree, and no PR'` (L14)

`deepEqual(status, { branch: 'main', dirty: false })`. Exact-object assertion. *Verdict:* correct.

### `'flags a dirty tree and includes a linked PR'` (L19)

Asserts the PR object is carried through by identity-equal shape. *Verdict:* correct.

### `'returns undefined when the path is not a git repo'` (L25)

The `git` throws for every call, so `rev-parse` rejects first. *Verdict:* correct.

### `'degrades to no PR when the lookup fails'` (L35)

`pr` throws; asserts the full clean status with no `pr` key. This pins the `.catch(() => undefined)`
inside `linkedPr`'s injected-seam branch. *Verdict:* correct.

### `'a run-scoped read does not wear a predecessor PR from a reused pinned branch (#1255)'` (L45)

The old PR is `MERGED` with `createdAt` two days before `since`. `pickAgentPr` finds no `OPEN` entry,
filters by `createdAt >= since` (empty), and returns undefined. The comment explains the real-world
shape (`the-framework/triage-quick`). *Verdict:* correct.

### `'a run-scoped read still shows the run its own PR, open or just merged (#1255)'` (L57)

Two halves. First: two merged PRs, one before and one after `since`; asserts the newer number,
proving the filter is on `createdAt` and not simply "the first entry". Second: an `OPEN` PR with no
`createdAt` at all alongside an old merged one; asserts the open one wins, proving the `OPEN`
short-circuit runs before the `since` filter (an open PR with no `createdAt` would be filtered out
otherwise). That second half is a genuinely good discriminator. *Verdict:* correct.

### `'a failing history read degrades to no PR, like the plain lookup (#1255)'` (L77)

Both `pr` and `prPending` asserted undefined. *Verdict:* correct.

## Bugs found

None found.
