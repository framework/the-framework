Effort: 0
Uncertainty: 1

# [Plan] Idea: also show daily `%` used

Verdict: both readings the ticket asks for are already implemented, tested, and spec'd in the dashboard's Usage card — recommend closing the ticket, with two narrower follow-ups available if the maintainer wants them.

## TLDR

The Usage card (the quota bar panel) already renders, on the line under the bar:

1. **Quota consumption as pro-rata quota time** — "`Xh Ym` spent": the percent of the week used, converted into a duration of the week's allowance.
2. **`%` of the pro-rata quota** — "`N%` of pace": consumption as a share of the pro-rata allowance elapsed so far, where 100% is exactly on pace.

The implementation itself cites this ticket's issue as its origin, so this is not a coincidental overlap — #1367 was implemented, and only the ticket was left open.

## Evidence

- `packages/framework/dashboard/components/Quota.tsx` — the figures line renders "`{formatDuration(consumedMs)}` spent" and "`{Math.round(paceShare)}%` of pace", each with a long-form tooltip. The code comment above them reads: *"The two readings #1367 asked for, beside the deviation rather than instead of it: what has been spent as quota time, and what it is as a share of the allowance elapsed so far."*
- `packages/framework/dashboard/lib/quota-bar.ts` — `consumedQuotaMs()` and `paceSharePercent()` (the latter's doc comment: *"Consumption against the pro-rata allowance elapsed so far (#1367)"*).
- `packages/framework/dashboard/lib/quota-bar.test.ts` — `describe('consumedQuotaMs (#1367)')` plus `paceSharePercent` coverage.
- `packages/framework/dashboard/components/Quota.SPEC.md` — section *"Pace stated as time, not just percent"* specifies both readings.
- `FEATURES-SPEC.md` — *"Usage panel: quota consumed, pace, projection"*.

## Deviations from the ticket's literal wording

Neither deviation undermines the ticket's intent; both are arguably improvements. Listed so the closing decision is informed:

1. **Pro-rata to the instant, not pro-rata-daily.** The ticket says "% of the pro-rata-*daily* quota". The shipped figure divides consumption by the allowance elapsed *at the current moment* of the week — a continuous version of the same idea, finer than a once-a-day step, and it matches exactly the quota boundary the daemon parks unattended work on (so the number the user reads is the number that acts).
2. **Account-level, not per-session.** The ticket's "how much pro-rata quota time *it* consumed" could be read as the individual session whose `$` spend is shown (per-agent spend lives in `AgentDetails.tsx`, folded from usage events). The shipped readings are account-level. Per-session quota-time attribution is not reliably computable: quota is read as account-global percent snapshots from the Claude Code CLI's usage readout (`packages/framework/src/driver/claude-code-quota.ts`), and concurrent sessions plus usage outside The Framework share the same account, so diffing snapshots around a session would misattribute. The plain reading of the issue (account pace next to account spend) is satisfied.

## Recommendation

Close the ticket as done:

- Remove `tickets/2026-07-29_show-daily-quota-percent.md` and this `.plan.md` from the data branch.
- Close GitHub issue [#1367](https://github.com/gemstack-land/the-framework/issues/1367) with a short comment pointing at the Usage card's "spent" and "% of pace" readings.

Only if the maintainer explicitly wants more, file as new, narrower tickets (not this one):

- A strictly *daily* figure ("today you used N% of a day's budget") in addition to the continuous pace share.
- Per-session quota-time attribution — noting the snapshot-attribution caveat above.
