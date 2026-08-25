# Bug analysis: packages/framework/src/ci-watch.ts

## Business logic (high-level)

The CI watch (#1418): polls the PRs the framework promised to land. Two halves per
`ci-watch.SPEC.md`:

- **Merge on green**: an ended agent whose meta says `mergeOutcome: 'watched'` gets its open PR
  merged once checks pass — the repo-without-auto-merge answer to #1417, guarded against the
  #1406 stale-check hazard ("merged seconds after opening, before its first check ran").
  `auto-armed` PRs are GitHub's to merge and are never merged here.
- **Fix on red**: a `watched` or `auto-armed` PR whose checks fail gets one unattended fix session
  per failing head commit (marker `[ci-fix] PR #N @sha` opens the prompt, making attempts
  discoverable from agent metas), at most one in flight per PR, at most two ever.

Conservatism requirements: not-OPEN PRs are done (CLOSED is a human's rejection — never pushed at);
`pending` waits; `none` merges only past a 3-minute attach grace, because "no checks" right after a
push means "the suite has not attached yet"; a PR whose age is unknowable never merges on
check-lessness; refused merges are remembered per head sha (re-armed by a new head, #1484); the
watch window is 7 days from the meta's last update; everything is logged, repeats once.

This file is where several intent sources meet, and three places break them:

1. **It acts on a half-answer.** `resolveAgentPr` returns a `Cached<LinkedPr>`; the cache contract
   (`dashboard/cache.ts`) says in as many words: "`pending` is not 'failed'… A caller that must
   not act on a half-answer… uses it to hold off", and `resolveAgentPr` fills the pending case
   with a synthetic record `{...agent.pr, state: 'OPEN', title: ''}`. The sweep ignores `pending`
   and trusts that synthetic `'OPEN'`. The cold-ask budget is 150ms while a `gh pr view`
   subprocess takes ~0.3–2s, so on the daemon's start-up tick essentially every watched agent
   resolves as pending-synthetic-OPEN. Consequences: an already-MERGED watched PR (<7 days old)
   goes down the merge path — `mergeAgentPr` re-resolves and usually refuses with "already
   merged", which the sweep then records in `attemptedMerges` and logs as "could not merge PR #N"
   on every daemon restart; worse, a CLOSED-by-a-human (or merged) PR whose head checks are red
   goes down the **fix** path, which does *not* re-resolve, and starts a real session that pushes
   commits onto the branch of rejected/landed work — exactly what the SPEC forbids ("closed
   unmerged — which is a person's rejection of the work and never something to reopen or push
   at"). Bugs #2.
2. **An unreadable CI status merges.** `ghPrCiStatus` returns `{checks: 'none'}` both for an empty
   rollup and for its own catch, and its doc states the contract: "Also the answer when `gh`
   itself could not say: acting on an unreadable status must never merge anything." The sweep's
   own `.catch` maps errors to `'none'` too — and then treats `'none'` + PR older than 3 minutes
   as "this repo has no CI" and merges. So one timed-out (8s read budget) or transiently failing
   `gh pr view` on a watched, possibly **red** PR older than 3 minutes merges it unverified — the
   #1406 failure the whole feature exists to prevent, reachable once per flaky read across a week
   of ~1/min polling. A cheap discriminator exists in-band: a successful view always carries
   `headRefOid`, so `checks === 'none'` with no `headSha` is precisely "could not say". Bugs #1.
3. **The no-checks grace is anchored to the wrong clock.** `pastNoChecksGrace` measures from
   `pr.createdAt`, but the constant's own doc says the hazard is the attach window "after a push".
   A PR older than 3 minutes that just received a push — the CI-fix agent's *own* push is the
   built-in trigger — reads `'none'` (fresh head, empty rollup) for the seconds-to-minutes before
   the suite attaches; a sweep tick landing in that window merges the unverified fix of a
   previously red PR. Window ÷ cadence makes this a several-percent chance per fix push. Bugs #3.

Ordering/concurrency otherwise: sequential per-project, per-meta loop; `seen` dedupes several
agents on one PR (first meta wins — if a `watched` and an `auto-armed` meta share a PR and the
`auto-armed` one is seen first, the merge half skips it; requires the repo's auto-merge setting to
have changed between runs, so noted, not reported). `attemptedMerges` keys are
`cwd\0number\0headSha` — cross-project and cross-PR safe; `checks:'none'` merges key with sha `''`,
so a refusal there is remembered per daemon lifetime (consistent with intent). The `startCiWatch`
wrapper has no timer (the daemon clock's job list drives `tick`, with a start-up turn seeded in
`daemon-tick.ts` — SPEC's "immediate sweep" holds); overlapping ticks join `inflight`; `stop`
breaks between projects. Its JSDoc still describes the pre-E4 shape ("the timer is unref'd", "an
immediate start-up tick") — stale comment, behavior correct via the daemon clock; noted only.

## Functions (low-level)

- **`CI_WATCH_WINDOW_MS` / `NO_CHECKS_GRACE_MS` / `MAX_CI_FIX_ATTEMPTS`**: 7d window from
  `updatedAt`, 3min attach grace, 2 attempts. Values match SPEC. Correct as data.
- **`ciFixMarker(number, headSha)`**: `[ci-fix] PR #N @sha`; the always-present `@` is what makes
  `marker(12)` not a prefix of `marker(123, ...)` — verified by the tests. Correct.
- **`ciFixPrompt(fix)`**: marker first line (so `meta.intent.startsWith(marker)` works — the
  daemon records the prompt as the intent, unbounded, so no truncation risk), then explicit git
  mechanics (`fetch`/`reset --hard origin/<branch>`/`push origin HEAD:<branch>`), the failing
  check names, and the do-not-open-a-PR/do-not-merge instruction. `failed.join(', ') || 'checks
  failed'` covers an empty list. Correct.
- **`allAgentMetas(cwd)`**: live + archived, each `.catch([])`. A meta can transiently appear in
  both during archival; downstream logic (dedupe by PR, attempts scan) tolerates duplicates.
  Correct.
- **`watchable(meta, now)`**: ended, `watched`/`auto-armed`, `updatedAt` parseable and within the
  window. Unparseable → excluded (fail closed). Correct.
- **`sweepProjectCi(cwd, deps)`**: the loop described above. Per-PR: resolve (catch → not-pending
  undefined), skip non-OPEN/dup; CI read (catch → `'none'`); `failing` → `requestFix`;
  green path gated on `watched`, the grace, and `attemptedMerges`; merge outcome recorded either
  way. Three bugs as analyzed (pending trust at L180-183; unreadable-status merge at L186+L196;
  see Bugs). Otherwise faithful to SPEC (auto-armed never merged, CLOSED left alone, pending
  checks wait).
- **`pastNoChecksGrace(pr, now)`**: `createdAt` parseable and older than grace; unparseable →
  `false` (never merge on unknowable age — matches SPEC). Anchor is wrong for pushes (Bugs #3),
  logic otherwise correct.
- **`requestFix(cwd, metas, pr, status, deps)`**: no wiring → silently none; no `headSha` or
  `branch` → stand down ("a retry could not be told from a loop"); dedupe by exact
  `marker(number, headSha)` prefix; any running attempt for the PR holds the next back; cap →
  `attempts-exhausted`; wiring declining → `declined`. Order means an exhausted PR whose exact sha
  already has an attempt reports nothing rather than `attempts-exhausted` — same net behavior
  (nothing started), and the sayOnce line already fired when the cap was first hit. Uses
  `pr.title` from the (possibly synthetic) linked record — under bug 2 the prompt's title is `""`;
  cosmetic. Correct in itself; inherits bug 2's tainted input.
- **`startCiWatch(opts)`**: seeds `attemptedMerges` (caller-supplied deps win), `said` set for
  once-per-lifetime lines (refusals and attempts-exhausted; merges and fix starts log every
  occurrence — each happens once per PR anyway), sequential project sweep with per-project catch,
  `inflight` join, `stop` flag. A refusal whose error text varies tick-to-tick would defeat
  `sayOnce`'s string keying — `gh`'s refusal texts are stable; noted only. Correct.

## Bugs found

1. **L196 (with the `.catch` at L186)** — an unreadable CI status is conflated with "this repo has
   no CI" and merges: `ghPrCiStatus`'s internal catch and the sweep's own `.catch` both yield
   `{checks: 'none'}`, and for a `watched` PR older than `NO_CHECKS_GRACE_MS` (i.e. virtually any
   watched PR) the `'none'` path proceeds to `merge`. One 8s-budget timeout or transient API/auth
   error on the `gh pr view --json statusCheckRollup…` read while the PR's checks are actually
   red/pending merges unverified work — violating the `PrCiStatus` doc's explicit contract
   ("acting on an unreadable status must never merge anything") and the #1406 promise the SPEC is
   built on. Severity: **critical**. Fix sketch: treat `'none'` as trustworthy only when the read
   demonstrably succeeded — e.g. `if (status.checks === 'none' && (!status.headSha ||
   !pastNoChecksGrace(linked, now()))) continue` (a successful view always carries `headRefOid`),
   and make the sweep's `.catch` skip the PR outright.

2. **L180-183** — the sweep acts on a pending PR resolution: `resolveAgentPr`'s half-answer
   (`pending: true`, synthetic `state: 'OPEN'`, empty title) is trusted as an open PR. With the
   cache's 150ms cold budget vs `gh`'s ~0.5s+, the daemon's start-up tick reads every watched
   agent this way: already-merged PRs produce a spurious merge attempt plus a once-per-restart
   "could not merge PR #N: this session's PR is already merged" log line and an `attemptedMerges`
   entry; a closed-or-merged PR whose head checks are red starts a **fix session** (the fix path
   never re-resolves) that pushes commits onto a branch a human rejected or already landed —
   forbidden by the SPEC's "closed stays closed" clause. Severity: **major**. Fix sketch: hold off
   on half-answers, as the cache contract instructs: `const read = await pr(...).catch(...); if
   (read.pending) continue` — the next tick has the real state.

3. **L210-214 (`pastNoChecksGrace`)** — the no-checks grace is measured from PR creation, not from
   the head commit's push: any push to a watched PR older than 3 minutes reopens the stale-check
   window, and the CI-fix half pushes to exactly such PRs by design. A sweep tick landing between
   the fix push and the check suite attaching sees `'none'` + past-grace and merges the
   unverified fix of a PR that was red a minute earlier (`attemptedMerges` doesn't block it — new
   head sha). Contradicts the constant's own rationale ("GitHub takes seconds to attach one after
   a push") and SPEC's "inside that window 'no checks' more likely means 'the suite has not
   started yet'". Severity: **major**. Fix sketch: anchor the grace to the head, not the PR —
   e.g. remember first-seen time per `cwd\0number\0headSha` in memory and require a headSha to
   have been check-less for the grace before trusting `'none'` (also covers human pushes), or
   include the head commit's committed date in the `gh` read and age that.
