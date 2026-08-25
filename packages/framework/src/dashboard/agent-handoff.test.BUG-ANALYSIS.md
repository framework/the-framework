# Bug analysis: packages/framework/src/dashboard/agent-handoff.test.ts

## Business logic (high-level)

The largest suite in the batch: pins the handoff read (fake-git table plus two real-repo
integration tests), the manual actions (push / open PR / remote-only PR / merge), the auto-handoff
ladder (#1102/#1216/#1512), the PR-identity rules (`pickAgentPr` #1251, `resolveAgentPr` E6), the
merge authorization matrix (#1363), PR titling (#1334/#1618) and bodies (#1567). Behaviors map
one-to-one onto `agent-handoff.SPEC.md`'s sections; the two real-repo tests pin the regressions
that motivated the ranges rationale (#1164 symmetric-difference bug, #1173 uncommitted-leftovers
flow) — these genuinely fail on the buggy spellings.

Fixture mechanics reviewed:

- `fakeGit` matches by *prefix* over insertion-ordered entries — checked every fixture for
  accidental prefix shadowing (`rev-parse --git-dir` vs the `rev-parse --verify` keys, `remote`
  vs `rev-parse … refs/remotes`): the chosen key spellings do not collide. Sound.
- `READY.log` is `` `abc123${SEP}abc${SEP}did the thing` `` — a *double*-separated line, so
  `parseCommits` yields `sha='abc123', subject='abc'` (the third field is dropped). Every
  assertion that touches it only needs `commits[0].sha === 'abc123'` (the #1512 head comparisons)
  or `commits.length > 0`, so the sloppy fixture changes nothing — noted, harmless.
- Real-repo tests configure user/email locally, run in `mkdtemp` dirs and `rm` in `finally`. No
  leakage; `git init -b main` keeps them independent of the host's default-branch config.

Do the tests verify their claims? Spot-checks of the sharpest ones:

- Draft flag (#1102): asserts `--draft` present on auto-handoff and absent on the manual open and
  on armed-merge opens — the load-bearing inbox rule, pinned in both directions. ✓
- Second-PR-never (#1102): the gh fake `assert.fail`s if called — cannot pass if a create sneaks
  through. ✓
- #1512 trio: fresh PR when the tip moved past a merged head; `already-landed` when the head is
  the tip; skip when the merged PR carries no head. All three assert the full outcome object. ✓
- Armed merge (#1216): asserts the exact `['pr','merge','9','--squash','--auto']` call order after
  create, ready-not-draft, and the `auto-armed` outcome; the already-open predecessor case asserts
  the merge runs with *no* create. ✓
- `pickAgentPr` (#1251/#1512): covers open-always-wins, closed-only-after-since,
  oldest-post-start for identity, `latest` for the handoff decision, and no-since → open-only. ✓
- `resolveAgentPr` (E6): recorded-number wins over a different live PR; unconfirmable → UNKNOWN
  with number/url; no recorded PR → zero lookups (counter asserted). ✓
- `withheldMerge` matrix (#1363): all four combinations. ✓
- `commitAgentWork` guards (#1173): project-root and wrong-branch cases assert *no git calls* /
  *no commit call* respectively, plus the end-to-end idempotence in the real repo. ✓
- Timeout vs rejection (#997): asserts the CliTimeoutError text survives `gitReason` and that
  `isCliTimeout` discriminates. ✓

Coverage gap worth naming: nothing exercises `openAgentPullRequest`'s decision ladder against a
branch-history lookup returning *two* post-start merged PRs — exactly the case where its
`'first'`-ordered pick diverges from auto-handoff's `'latest'` (the bug reported in
`agent-handoff.BUG-ANALYSIS.md`). The suite tests auto-handoff's ladder thoroughly but the manual
button's ladder only implicitly. Gap, not a wrong assertion.

## Functions (low-level)

- `fakeGit(answers)` — prefix-matched stub recording calls; throws on a miss so an unexpected git
  invocation fails loudly. Correct for its fixtures.
- `titleOf(agent)` — drives a full auto-handoff to extract `--title`; fine.
- ~40 `test()` blocks — all `await`ed where async; assertions falsifiable; `assert.fail` tripwires
  used where absence is the assertion. No test found that cannot fail.

## Bugs found

None found in the test file itself.
