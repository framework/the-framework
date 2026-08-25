# Bug analysis: packages/framework/src/dashboard/gh.ts

## Business logic (high-level)

The single `gh` adapter for the whole daemon: the JSON reads the dashboard makes, the write actions
the handoff performs, and the cached forms of both. It replaced four hand-rolled adapters that each
spelled `execFile` + `JSON.parse` + a swallowed failure and each restated the timeout.

**Two runner classes, on purpose.**

- `readGh` — 8 s, module-level, no `preferStderr`. Reads are capped short and never surface an error:
  every caller is a panel that renders whatever it got, and "gh is not installed" must cost a page
  load nothing.
- `nodeGhRunner()` — 60 s, `preferStderr: true`. Write actions talk to the network and to git, and a
  user is waiting on a button; the CLI's own stderr ("not logged in", "no default remote") is the
  message worth showing. Verified against `cli-exec.ts`: `preferStderr` only shapes the *rejection*,
  so a successful `--json` read still resolves stdout — which matters because `fallbackMerge` reuses
  the merge runner for `ghPrCiStatus`, and a runner that returned stderr on success would break the
  JSON parse there.

**Forgiving vs. honest reads — the load-bearing asymmetry.** Almost every read here swallows its own
failure into an empty answer. `ghPrList` deliberately does *not*: its caller (`interventions.ts`)
keeps a baseline of what it has already announced, so "no PRs are open" swallowed from "I could not
look" would make the next successful read announce the entire open backlog as new (#1623). Likewise
`ghPrsForBranchOrThrow` exists purely so the PR-opening path can tell "none" from "could not tell" —
mistaking one for the other opens a second draft PR on a branch that already has one (#1601). Both
exceptions are correct and both are documented at their definition.

**The reused-branch problem (#1251/#1255).** `gh pr view <branch>` answers the newest PR for that head
*in any state*, so a session on a pinned branch name inherits a predecessor's merged PR. The fix is
structural: keep the whole history (`ghPrsForBranch`) and let `pickAgentPr` decide which entry, if
any, belongs to the asking agent — an open one always, a closed one only when created after the agent
started.

**The lands-before-CI hazard (#1406/#1418).** GitHub auto-merge is tried first so a PR lands when its
checks pass. Where the repo does not allow it, `MergePrOptions.whenUnarmed` decides: `merge-now`
(a human just pressed the button) merges directly; `watch` (the automatic path) merges only when the
checks are *already* green and otherwise defers to the daemon's CI sweep. Crucially the decision is
made from a checks read, not from the refusal text — `clean status` sounds like "nothing blocks this"
but GitHub also says it while non-required checks run.

**Cache keys.** `pr` + NUL + cwd + NUL + branch-or-empty, `prs` + NUL + cwd + NUL + branch, and
`auto-merge-allowed` + NUL + cwd. NUL is the separator precisely because a path cannot contain one,
so keys cannot collide. The same idea is spelled twice — an inline escape in `prCacheKey`, the
`KEY_SEP` constant for the other two — which is cosmetic only. `forgetPr` / `forgetBranchPrs` mirror
their key builders exactly.

**A note on the un-branched key.** `git-status.ts` reads the project row through `cachedPrView(cwd)`
(branch component empty), and nothing ever invalidates that key — only the branch-scoped form is
forgotten after a merge. The project row therefore self-heals on the cache TTL instead of
immediately. That is a cache doing its job rather than a defect: the row is a badge, and the
branch-scoped read is what the Merge button consults.

## Functions (low-level)

### `nodeGhRunner()` (L23-25) / `readGh` (L31)

Two `cliRunner` configurations. `nodeGhRunner` is constructed per call site (it is a default argument
in several signatures), which allocates a closure per invocation and nothing else. Correct.

### `githubToken(cwd, env, gh)` (L47-59)

`GH_TOKEN ?? GITHUB_TOKEN`, else `gh auth token`.

- `GH_TOKEN=''` — `??` does not fall through on an empty string, but the `if (fromEnv)` truthiness
  check does, so an empty variable correctly falls back to the CLI. Pinned at `gh.test.ts:51`.
- `gh auth token` printing whitespace → `.trim() || undefined` → `undefined`, so an empty string never
  sails past a caller's `if (!token)` and fails later at the API. Pinned at `gh.test.ts:44`.
- gh missing / logged out / refusing (a keyring prompt) → `undefined`, deliberately without the
  stderr. Correct: the caller's message names both fixes.

*Verdict:* correct.

### `ghJson<T>(args, cwd, empty, gh)` (L62-68)

One `try` around both the exec and the parse, so a non-zero exit, a timeout and non-JSON output all
land on `empty`. Correct for the forgiving reads; the two honest reads deliberately do not use it.

### `ghPrView(cwd, branch?, gh)` (L114-127)

Asks for `PR_VIEW_FIELDS` and copies fields out one by one rather than passing the parsed object
through, so a future `--json` addition cannot leak into what callers store.

- The copy-out and the field list must stay in step — the #1334 defect was exactly that they did not,
  and `createdAt` was silently absent for every caller, which made a check-less PR's age unknowable
  and such a PR unmergeable forever. Both halves are now pinned by `gh.test.ts:240` and `:248`.
- Optional fields are spread conditionally, so "gh did not answer with it" stays distinguishable from
  "it has none". Pinned at `gh.test.ts:264`.
- If gh ever answered `{}` the result would be a `LinkedPr` whose required fields are `undefined`.
  `gh pr view` errors rather than emitting `{}` when there is no PR, so this is unreachable outside
  the test fixture at `:241`.

*Verdict:* correct.

### `cachedPrView` / `cachedPrsForBranch` / `cachedRepoAutoMerge` (L138, L378, L373)

Thin `cachedRead` wrappers. `cachedRepoAutoMerge` overrides the TTL to 5 minutes because a repo
setting barely changes while the launcher polls; the other two take the default. Correct.

### `forgetPr` / `forgetBranchPrs` / `prCacheKey` / `branchPrsCacheKey` (L143-149, L383-392)

Symmetric with their readers. Correct.

### `ghPrsForBranch` / `ghPrsForBranchOrThrow` / `prListArgs` / `linkedPrs` (L160-186)

Shared argument builder and shared copy-out, differing only in whether a failure is swallowed. The
copy-out is the same shape as `ghPrView`'s, so the two paths cannot drift in what they keep.
`--limit 20` bounds the history; a branch with more than 20 PRs would lose the oldest, which cannot
matter since `pickAgentPr` wants the open one or a recent one. Correct.

### `ghMergePr(cwd, number, gh, opts)` (L221-249)

*Never throws* — every path returns an `AutoMergeOutcome`.

- Happy path: `pr merge --squash --auto` → `auto-armed`.
- `/draft/i` on the refusal → `pr ready` then retry the armed merge. The retry's own refusal is
  re-tested against `DIRECT_MERGE_FALLBACK`, so a readied draft on a repo without auto-merge still
  falls through — pinned at `gh.test.ts:117`. Only one retry, so no loop.
- Any other refusal → `failed` with the CLI's message, never a direct merge. This is the important
  negative: retrying a "not mergeable" without `--auto` could land a PR GitHub just refused. Pinned at
  `gh.test.ts:84`.
- The `/draft/i` test is on the whole refusal text, so a refusal that merely mentions the word (a PR
  titled "draft schema" quoted back by gh) would take the ready-then-retry path. `gh` does not echo
  the title in its merge errors; recorded, not reported.

*Verdict:* correct.

### `fallbackMerge` / `directMerge` (L261-276)

`merge-now` → direct. `watch` → a checks read decides; only `passing` merges now, and `none` does not,
because a suite takes seconds to attach and a just-opened PR reads check-less exactly then. `failing`
also defers, which is right — the sweep will start a fix rather than merge. `directMerge` wraps its
own failure into `failed`. All three watch-mode branches pinned at `gh.test.ts:192`, `:201`, `:208`.

*Verdict:* correct.

### `ghPrCiStatus(cwd, number, gh)` (L307-341)

Folds GitHub Actions check runs and classic commit statuses into one verdict.

- Unreadable gh / non-JSON → `{ checks: 'none', failed: [] }` **without** `headSha`. That omission is
  the signal `ci-watch.ts` uses to tell "this repo has no CI" from "I could not read": at
  `ci-watch.ts:201` it refuses to merge a check-less PR whose read carried no head commit. A neat,
  load-bearing detail, and the reason the doc's "acting on an unreadable status must never merge
  anything" actually holds.
- Empty rollup → `none`, with the head fields when they were read.
- A check run: `done` iff `status === 'COMPLETED'`; `SUCCESS|NEUTRAL|SKIPPED` pass, everything else
  that concluded (`FAILURE`, `CANCELLED`, `TIMED_OUT`, `ACTION_REQUIRED`, `STALE`) fails. Matches
  GitHub's own merge box for the first three and is deliberately conservative for the rest.
- `conclusion: null` on an in-progress run → `?? entry.state ?? ''` yields `''`, but `status` is
  `IN_PROGRESS`, so `done` is false and it counts as pending rather than as a failure. Correct — the
  `null`/`??` interaction is the subtle part, and `gh.test.ts:169` covers it.
- A classic status has no `status` field, so `done` is `state !== 'PENDING'`. `SUCCESS` passes,
  `FAILURE`/`ERROR` fail, `PENDING` waits.
- **`EXPECTED`** — the fifth value of GitHub's `StatusState` enum, meaning a required context has been
  declared but not reported — takes the `done` branch and is counted as *failed*. See Bugs found #1.
- One failure makes the whole thing `failing` even while others run: "more green later will not unsay
  it". Correct and stated.
- `failed` names fall back through `name → context → 'unnamed check'`, so the fix agent's prompt never
  contains `undefined`.

*Verdict:* bug found (#1).

### `ghRepoAutoMerge(cwd, gh)` (L362-370)

Probes the REST endpoint rather than `gh repo view --json autoMergeAllowed`, which has no such field
in any gh version and therefore always errored into "could not say". Three ways to be unknown — gh
failed, output was not JSON, or `allow_auto_merge` is absent (REST omits it for viewers without push
access) — and all three land on `{ known: false, allowed: false }`, which renders nothing rather than
a wrong "off". The `typeof … !== 'boolean'` test is what makes the absent case unknown rather than
false. All four cases pinned at `gh.test.ts:212`. *Verdict:* correct.

### `pickAgentPr(prs, since, order)` (L410-418)

- An `OPEN` PR always wins, before `since` is even consulted — right, because GitHub allows one open
  PR per head branch, and because an open PR may legitimately have no `createdAt` in a caller's data.
- No `since` → only an open PR is trusted. Correct.
- Otherwise: closed PRs with `createdAt >= since`, sorted oldest first, and `order` picks an end.
  `'first'` answers identity (which PR did *this* agent open); `'latest'` answers the handoff question
  (which PR last saw the branch), where the oldest entry would call work a second PR already landed
  unlanded.
- The comparison is lexicographic on ISO-8601 UTC strings, which is chronological for that format.
  GitHub emits whole seconds (`…:59Z`) while the store's `startedAt` carries milliseconds
  (`…:59.123Z`); within the same second the `'Z' > '.'` ordering makes the PR count as "after". A
  sub-second misjudgement on a boundary nobody can hit meaningfully — recorded, not reported.
- The comparator returns `1` for equal timestamps rather than `0`, so two PRs created in the same
  second could swap under a stable sort. Two PRs on one branch in one second do not occur.
- `prs` empty → `undefined`. A PR with no `createdAt` is filtered out of the closed set. Correct.

*Verdict:* correct.

### `ghPrList(cwd, gh)` (L446-450)

`--state open --limit 50`, and it lets a failure reject. The `--limit 50` cap silently truncates a
project with more than 50 open PRs; a "needs you" queue of fifty is already past useful, so the cap is
a product choice rather than a defect. *Verdict:* correct.

## Bugs found

1. `L335`: a classic commit status in GitHub's `EXPECTED` state is counted as a *failed* check rather
   than a pending one, which turns a PR that is merely waiting for a required context into a red one.
   `done` is computed as `verdict !== 'PENDING'` for an entry with no `status` field (the classic
   `StatusContext` shape), and `EXPECTED` is not `PENDING`, so the entry is marked done and then fails
   the `/^(SUCCESS|NEUTRAL|SKIPPED)$/` test. Scenario: a repo whose branch protection requires a
   classic status context that has not reported yet; `sweepProjectCi` (`ci-watch.ts:192`) reads
   `checks: 'failing'` and spawns a CI-fix agent against a check that never ran and that no code
   change can fix. This contradicts `PrCiStatus`'s own documentation, which reserves `failing` for "at
   least one concluded check failed". Severity: minor. Confidence: low — it needs classic commit
   statuses (not Actions check runs) under branch protection, and whether gh's `statusCheckRollup`
   surfaces an unreported required context at all is not verifiable from here. Fix: treat `EXPECTED`
   as not-done alongside `PENDING`, e.g.
   `const done = entry.status ? entry.status === 'COMPLETED' : !/^(PENDING|EXPECTED)$/.test(verdict)`.
