# Bug analysis: packages/framework/src/dashboard/gh.test.ts

## Business logic (high-level)

Eighteen tests over `gh.ts`, all driven by a fake `GhRunner` — no subprocess, no network. Since every
function in `gh.ts` takes its runner as a defaulted last parameter, that seam is enough to cover the
whole module without touching the real CLI.

Grouped by what they pin:

- **`githubToken` (#1352)** — env wins over the CLI and the CLI is *not consulted* (asserted by an
  empty `calls` array, not just by the return value); both env spellings; the CLI fallback with its
  exact argv; a missing/refusing gh yielding `undefined` rather than throwing; blank CLI output
  yielding `undefined`; and an empty env variable falling through rather than counting as a token.
- **`ghMergePr` (#1216)** — the armed merge and its exact argv; the two known auto-merge refusals
  falling through to a direct merge; any other refusal being reported rather than retried; the
  draft → `pr ready` → retry sequence; a readied draft still falling through; and a direct merge that
  also fails reporting the *second* refusal.
- **`ghPrCiStatus` (#1418)** — all-green, a concluded failure alongside a running check, a running
  check alone, classic commit statuses in both pending and failed form, an empty rollup, and an
  unreadable gh.
- **`ghMergePr` in watch mode (#1418)** — running checks answer `watched` and merge nothing; green
  checks merge directly; no checks defer to the watch.
- **`ghRepoAutoMerge` (#1417)** — true, false, and the three flavours of "could not say".
- **`ghPrView` (#1334)** — the field list and the copy-out, deliberately exercised through the real
  `PR_VIEW_FIELDS` constant.
- **`ghPrList` (#1623)** — it rejects rather than resolving `[]`.

**Do the tests verify what they claim?** Yes, and several are unusually well-aimed:

- `:17` asserts `deepEqual(calls, [])`. Asserting the *absence* of a call is the only way to pin "the
  CLI is not consulted at all", and a naive test would have checked only the returned token.
- `:63` and `:110` assert the full `calls` array, so the argument order and the exact sequence of
  attempts are pinned, not merely the outcome.
- `:198` uses a negative predicate — `!calls.some(args => args[1] === 'merge' && !args.includes('--auto'))`
  — which is exactly the #1406 hazard stated as an assertion: in watch mode nothing may run an
  unarmed merge. A result-only assertion would have missed a version that merged *and* reported
  `watched`.
- `:240` is a meta-test: it reads the `--json` argument out of the recorded call and checks each field
  name is present. The comment above it explains precisely why the bug survived — every ci-watch test
  injects its own PR lookup, so what this function asks gh for was the one thing nothing exercised.
  Testing the argv rather than the parsed result is the right response to that class of defect.
- `:264` asserts `!('createdAt' in pr)` rather than `pr.createdAt === undefined`. Those differ, and
  only the former pins the conditional spread that keeps "we do not know" distinguishable from "it has
  none".
- `:272` uses `assert.rejects`, so the honest-failure contract is pinned as a rejection rather than as
  a sentinel value.

**Fixture fidelity.** `watchModeGh` is a small state machine that refuses `--auto` like a repo without
auto-merge and answers `pr view` with a real-shaped rollup including `headRefOid`/`headRefName`. Using
one fixture for both `ghPrCiStatus` and the watch-mode `ghMergePr` tests means the two are exercised
against the same gh behaviour, which is what the production path does. The draft fixtures at `:95` and
`:117` flip a `drafted` flag inside the runner so the retry genuinely sees a different world — a
constant-answer fake would have made the retry test vacuous.

**Gaps (not defects).** `pickAgentPr` is not tested here (it is covered in `agent-handoff.test.ts:779`
and indirectly by `git-status.test.ts`); the cached wrappers, `forgetPr`/`forgetBranchPrs`,
`ghPrsForBranch` and `ghPrsForBranchOrThrow` have no tests in this file; the `EXPECTED` classic-status
value is not exercised, which is the gap that hides the defect recorded in `gh.BUG-ANALYSIS.md`; and
no test covers `whenUnarmed: 'watch'` with *failing* checks (it should also answer `watched`).

## Functions (low-level)

### `fakeGh(stdout)` (L7-15)

Returns `{ gh, calls }`; the runner records argv then either throws the given `Error` or resolves the
given string. One fixture covers both the success and failure shapes, which keeps the tests short. It
ignores the `cwd` argument, so nothing here can catch a regression that passed the wrong working
directory — a real gap, though `gh.ts` threads `cwd` straight through in every function.

### The `githubToken` tests (L17-55)

Six tests, each isolating one branch. `:29` asserts the argv (`[['auth', 'token']]`), so a change to
the subcommand fails it. `:44` covers both `''` and `'  \n'` in one test, pinning the `.trim() ||`
idiom rather than just a non-empty check. *Verdict:* correct.

### The `ghMergePr` tests (L57-143)

- `:57` — argv-exact happy path.
- `:63` — loops both known refusal spellings, rebuilding the runner per iteration so `calls` does not
  leak between them. Asserts the full two-call sequence.
- `:84` — a non-matching refusal, asserting both the `failed` outcome *and* that only one call was
  made. The comment states the danger (landing a PR GitHub just refused).
- `:95` / `:117` — the draft paths, with the stateful fixture described above. `:117` asserts only
  `calls.at(-1)`, which is enough: the outcome plus the last call identify the path taken.
- `:134` — the second refusal is the one reported. Would fail if the code kept the first error.

*Verdict:* correct.

### The `ghPrCiStatus` tests (L155-190)

- `:155` — green (including a `SKIPPED` conclusion, which must count as passing) asserted as a full
  `deepEqual` including `headSha` and `branch`, so the head fields riding this read are pinned too.
  Then red: a concluded `FAILURE` beside an `IN_PROGRESS` run, asserting `failing` and that only the
  concluded one is named. Note it calls `ghPrCiStatus` twice on the same fixture for the two
  assertions — wasteful but harmless, since `watchModeGh` is stateless for `pr view`.
- `:176` — an in-progress check run, then a classic `PENDING` status, then a classic `FAILURE` whose
  name comes from `context` rather than `name`. That last assertion is what pins the
  `name ?? context ?? 'unnamed check'` fallback.
- `:186` — an empty rollup is `none`; an unreadable gh is `none` **with no head fields**, asserted by
  a full `deepEqual`. That exact-object assertion is load-bearing: `ci-watch.ts` distinguishes the two
  by `headSha`'s presence, so a regression that manufactured a `headSha` here would let it merge a PR
  whose status was never read. Good test.

*Verdict:* correct.

### The watch-mode tests (L192-210)

Three tests covering `pending`, `passing` and `none`. `:192`'s negative assertion is the strongest of
the three. `:208` asserts only the outcome, which is sufficient given `:192` already pins that
`watched` performs no unarmed merge. *Verdict:* correct.

### The `ghRepoAutoMerge` test (L212)

One test, five cases, including the argv. The `{"full_name":"acme/repo"}` case is the subtle one —
REST omits `allow_auto_merge` for viewers without push access, and it must land on "unknown", not on
"off". *Verdict:* correct.

### The `ghPrView` tests (L240-270)

`:240` checks the argv's `--json` field list against every field `LinkedPr` declares; `:248` checks
the copy-out keeps `createdAt` and `headRefOid`; `:264` checks an absent field stays absent. Together
they close both halves of #1334. Note `:240` feeds `'{}'`, so `ghPrView` returns an object of
undefined fields — never asserted, and irrelevant to what the test is about. *Verdict:* correct.

### The `ghPrList` tests (L272-284)

`assert.rejects` for the failure, and a parse plus an argv spot-check for the success. `:280` asserts
`calls[0]!.includes('--json')` rather than the whole field list — weaker than `:240`'s treatment of
`ghPrView`, so a regression that dropped `isDraft` or `headRefName` from `ghPrList`'s field list would
not be caught here (the draft-policy tests in `interventions.test.ts` inject their own lister, so they
would not catch it either). A gap, not a wrong assertion. *Verdict:* correct.

## Bugs found

None found.
