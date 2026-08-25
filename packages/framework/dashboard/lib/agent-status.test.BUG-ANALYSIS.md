# Bug analysis: packages/framework/dashboard/lib/agent-status.test.ts

## Business logic (high-level)

Pins the pill's ranking and its windows: silence before anything happened; building… while live,
settling on end; ready-for-merge; ended-state precedence (stopped/failed beat an earlier
ready-for-merge, failure carries detail); the #1431 publishing… window (opens on a clean armed
end, closes on the `handoff` report, outranks ready-for-merge, does not open when disarmed /
never armed / not cleanly ended); and the #762/#1450 resume semantics (a new `session` boundary
re-opens building and a fresh publishing window).

Do the tests verify what they claim? Yes — each builds a minimal event feed (casting simple
object literals to FrameworkEvent, which keeps the fixtures honest about which fields matter) and
asserts on the produced label via `toMatchObject`. The precedence claims are tested with feeds
that genuinely hold both facts at once (ready-for-merge + stop/fail), which is the point of the
ranking. The no-window test covers all three negative arms, including the important
absent-means-armed guard (an archive with no `handoff-armed` event must not read as
forever-publishing).

Gaps (noted; the first is where the source bug hides):

- Every non-null case includes the `named` event, so the suite never exercises an *unnamed* ended
  agent — which is exactly the case the source gets wrong (clean end without a session name →
  null instead of "finished"/"publishing…"; reported in agent-status.BUG-ANALYSIS.md). A test
  like `agentStatusPill([ended({ ok: true })])` would have caught it.
- Dot/tone fields are never asserted (labels only) — acceptable; they are presentation constants.
- `toMatchObject` on a possibly-null return relies on the matcher failing for null — it does
  (matcher error), so no vacuous pass.

## Functions (low-level)

- Fixture helpers `named`/`readyForMerge`/`ended(over)`/`armedPush`/`handoffDone` — minimal casts;
  `ended` spreads overrides so `ok`/`stopped`/`detail` combinations are expressible. Correct.

## Bugs found

None found (the coverage gap that hides the source's silence-gate bug is recorded above and the
bug itself is filed against agent-status.ts L25).
