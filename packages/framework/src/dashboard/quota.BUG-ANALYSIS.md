# Bug analysis: packages/framework/src/dashboard/quota.ts

## Business logic (high-level)

Feeds the usage panel (#533) and answers the boundary question (#879/#1619) from one continuously polled reading — the #960 "one source" promise: the bar the user reads and the line auto PM obeys derive from the same `QuotaPoller` windows and the same spend-offset preference, so they cannot disagree about the account.

Invariants per SPEC, all traced through the code:
- **Stale beats blank**: `read()` serves `lastGood.windows` even when `latest.available === false`, attaching `unavailable: latest.reason` so the UI marks stale instead of blanking — an empty `windows` plus no `unavailable` is genuinely "no reading ever".
- **Unknown ≠ nothing allowed**: `boundary` is spread only when `quotaBoundaryStatus` returns one; no reading or an unplaceable week reset → absent (the tests pin both).
- **Two questions, one reading**: `read()`/`boundaryFor()` share `measure()`; the panel's call names no model on purpose (the documented #1619 rationale for a second method rather than an optional argument), `boundaryFor(model)` adds the model's own week. `boundaryFor(undefined)` equals the panel's answer (tested).
- **Measured per call**: `measure` re-reads `poller.current()`, `now()`, and `limitOffset()` on every ask — the boundary moves with the clock and the slider without a restart, and neither ask costs a fresh quota reading.
- **Never interrupt on low quota** (MEMORY): nothing here gates a running session; this file only reads/measures. Consistent.

Failure modes: `limitOffset()` in `defaultQuotaSource` catches the registry read (`.catch(() => ({}))`) and falls back to `DEFAULT_SPEND_OFFSET` — a fresh install's policy, as specced. A caller-supplied `limitOffset` that rejects would reject `read()`/`boundaryFor()`; the only production wiring is the guarded one. `stop()` delegates to `poller.stop()`, and `startDashboard` calls it on close (verified in server.ts), so the life-of-the-dashboard poller does not outlive the server.

## Functions (low-level)

- **`pollerQuotaSource(poller, now, limitOffset)`** — `measure(model?)`: windows from `lastGood` (or `[]`), `quotaBoundaryStatus({ windows, now: now(), ...(model ? { model } : {}), limitOffset: await limitOffset() })`. Model spread only when truthy — an empty-string model degenerates to the account week, which matches "no model given is the account's week alone". `read()`: assembles `QuotaView` with conditional spreads for `boundary`/`readAt`/`unavailable`; `readAt` uses `lastGoodAt !== undefined` so epoch 0 would still serve (pedantically correct). Verdict: correct.
- **`defaultQuotaSource(env)`** — real `ClaudeCodeDriver` + `QuotaPoller`, `poller.start()` immediately (polls for the dashboard's whole life, deliberately separate from the per-agent guard), slider read live from preferences per call. Verdict: correct.
- **`QuotaView`/`QuotaSource` interfaces** — documented semantics match the implementation (notably `unavailable` alongside stale windows). Correct.

## Bugs found

None found.
