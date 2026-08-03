Status: open
GitHub: [#1490](https://github.com/gemstack-land/the-framework/issues/1490)

# Per-run quota guard ignores the Usage slider (autoSpendOffset): runs pause while the bar shows room

## TLDR

Dashboard-started Fable runs pause at the first turn boundary with "Quota boundary reached (Current week (Fable))" even with the Usage slider dragged well above the model's weekly usage. The slider writes `preferences.autoSpendOffset` (#960) and the daemon reads it in exactly one place (`dashboard/quota.ts`, `defaultQuotaSource`) precisely so surfaces can't disagree — but the per-run guard never got the memo: `consumption-guard.ts:70` passes the hard-coded `DEFAULT_SPEND_OFFSET` (≈7.1 points), so a run's stop line is always `boundary + 7.1` regardless of the slider. Fix direction: thread an injectable `limitOffset` supplier into `startConsumptionGuard` (mirroring `QuotaSource`'s), read from the registry the way `defaultQuotaSource` does and refreshed per gate check — so dragging the slider unblocks a parked run's next boundary check without a restart; `DEFAULT_SPEND_OFFSET` stays the fallback (fresh install, unreadable registry).

## Why it matters

This is the exact bar-vs-guard disagreement the #960 single-source rule exists to forbid: the bar the user reads shows plenty of room while runs park. Live repro on three runs (2026-08-02): week ~25% elapsed, Fable week 40% used, slider at ~65% — still paused. Sonnet runs pass only by coincidence (the all-models week sits under the default line), not because anything honors the slider.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1490](https://github.com/gemstack-land/the-framework/issues/1490), created 2026-08-02, no labels, 0 comments. A fix PR (#1491, "Per-run quota guard honors the spend slider") went up minutes after the issue and is open at import time.
