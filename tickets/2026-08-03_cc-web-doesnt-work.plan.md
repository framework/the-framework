Effort: 1
Uncertainty: 2

# [Plan] CC web doesn't work

Verify-and-close plan: the fix has already landed (#1544 + #1518); the only remaining work is the parallel-`.plan.md` re-test — which the current concurrent plan batch itself performs — then closing #1496 on its evidence.

## TLDR

No code is left to write for this ticket. The two root causes are fixed and proven on a single run:

- **Provisioning (#1544):** the stuck sessions were bundle-provisioned and couldn't push; web sessions now provision repo-bound and can push and open PRs.
- **Behavior (#1518):** the hands-off closure instruction makes a launcher run go all the way to a merged PR with no human step after send.
- **Single-run proof:** run `2026-08-17T10-52-38-535Z` → PR #1546, 39s after hand-off; chain evidence on #1320 (now closed).

What the ticket still asks for before closing: re-test the *parallel* shape — N concurrent "Run on: Claude web" sessions each producing a `.plan.md` (the #1327 fan-out). That re-test is running right now: commit `a0b430e` locked 3 tickets (`CLAIMED: plan-1786970862092-{0,1,2}`) and fired 3 concurrent web plan agents, one of which authored this file. If the batch lands cleanly, close #1496.

## Pass criteria for the parallel re-test

The batch passes if, for each of the 3 locked tickets:

1. The agent pushed a commit to its own designated branch containing the real `.plan.md` and deleting its `.lock.md` (lock lifts when work lands).
2. A PR exists for that branch and is mergeable — no session stuck at the pre-push state that defined this bug.
3. No cross-claim occurred: each `.plan.md` was authored only by the agent named in the corresponding lock.
4. No human step was needed between send and PR.

## Considerations

- **3 vs 10 concurrency.** The ticket says "N concurrent web runs"; this batch is N=3. That is enough to close *this* ticket (it demonstrates the parallel shape works at all — the original failure was total, not load-dependent). Scaling to the full 10-agent fan-out, plus lock staleness/reclaim rules, is #1327's scope and stays there.
- **Branch-disjointness makes concurrency safe.** Each agent pushes to its own branch; the only shared write was the lock commit, done once by the daemon on main before the batch started (per #1420's mechanism). No agent edits `TODO_AGENTS.md` or other shared files in this batch, so no merge conflicts are expected between the 3 PRs.
- **Partial failure.** If one agent stalls or can't push while the others land, the bug is not "cc-web doesn't work" anymore — file the specific failure (session id, last state, whether push or provisioning failed) as a new narrow ticket, release that ticket's lock via the Release-lock button (#1425), and still close #1496 if the failure is agent-behavioral rather than platform-level.
- **Quota.** Per MEMORY.md, quota gates session start only; a batch that starts is never cut short. A batch that fails to *start* some agents is a quota observation, not a regression of this bug.

## Implementation

1. Let the current 3-agent batch finish; check the pass criteria above against the 3 PRs and the locked tickets' final state.
2. On pass: close GitHub issue #1496 with links to the batch's PRs as parallel-shape evidence, and remove `tickets/2026-08-03_cc-web-doesnt-work.md` (plus this `.plan.md`) from the repository — tickets/ holds open tickets only.
3. On fail: reopen the investigation scoped to the observed failure mode (see Partial failure above); this plan is then outdated.
