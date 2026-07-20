---
'@gemstack/framework': minor
---

Pace spending against a quota boundary instead of configured limits (#879)

The Framework now spends up to a moving boundary derived from the account's own week:
by the nth day of the quota week, at most n/7 of the week's allowance. The last day of
the week allows all of it, so nothing is left on the floor. Work you ask for may cross
the boundary and borrow against the days to come; unattended work stands down at it.

There is nothing to configure. The three consumption limits, their preference
(`consumptionLimits`) and their panel rows are gone, along with the rolling meter that
derived usage by diffing readings. The boundary is a comparison of two numbers the
agent reports, so it owes nothing to how long the daemon has been running.

Removed from the public API: `ConsumptionMeter`, `consumptionStatus`, `budgetsFrom`,
`DEFAULT_CONSUMPTION_LIMITS`, `CONSUMPTION_LIMIT_LABEL`, `resolveConsumptionLimits`,
`FIVE_HOURS_MS`, `ONE_DAY_MS` and their types. Added: `quotaBoundaryStatus`,
`boundaryFromResetsAt`, `parseResetsAt`, `QUOTA_WEEK_MS`. `QuotaView.limits` is replaced
by `QuotaView.boundary`, and a run's `consumptionGate` now returns the label of the
window that reached the boundary rather than a window enum.
