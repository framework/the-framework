# Bug analysis: packages/framework/src/quota-poller.ts

## Business logic (high-level)

Keeps a recent `DriverQuota` reading on hand (#525): poll every 5 minutes when healthy, double the gap per consecutive transient failure up to 30 minutes, reset on success; keep `lastGood` through transient failures; on an authoritative failure (`no-subscription`, `agent-not-found`) discard `lastGood` and stop for good. Verified against `quota-poller.SPEC.md` and `isTransientQuotaReason` (`fetch-failed`/`timeout`/`unrecognized` transient — the #960 fix that keeps one unreadable readout from killing the poller for the daemon's life).

Lifecycle and ordering analysis:

- **`start()`** — idempotent (`running` guard), refuses after `stop()` (`stopped` guard), fires an immediate un-awaited poll then schedules. Matches SPEC ("first reading immediately", "a stopped poller cannot be restarted").
- **`stop()`** — idempotent; clears the pending timer. If a poll is in flight when `stop()` lands, its `.finally(schedule)` re-checks `stopped` and does not re-arm — no timer leak, no zombie polling.
- **Authoritative stop from inside a poll** — `onBad` → `this.stop()`; the surrounding `schedule()` call (from the timer callback's `.finally`) early-returns. Correct.
- **Timer hygiene** — each scheduled timer `unref?.()`d so the daemon's lifetime is decided elsewhere (MEMORY.md: foreground CLI). The initial `start()` poll is not a timer, so nothing to unref there. Correct.
- **Backoff arithmetic** — `currentIntervalMs` doubles in `onBad` (capped) and resets in `onGood`; `schedule()` reads it after the poll folded in, so the next gap always reflects the newest outcome. On-demand `poll()`s during an outage also double the gap — slightly faster backoff than timer-only, which errs in the safe direction (upstream penalty window).
- **Envelope discipline** — `latest` always replaced; `lastGood`/`lastGoodAt` only on success; both cleared on authoritative failure so a retained number can never misrepresent an account with nothing to read. `current()` returns a shallow copy (fields treated as immutable by consumers).
- **A throwing driver** — mapped to `{available:false, reason:'fetch-failed'}` inside `poll()`, so `poll()` itself never rejects; the `void`ed call sites therefore cannot produce unhandled rejections. Correct.

Concurrency edge (the one real gap): `poll()` is documented "safe to call on demand ... alongside the timer", so two polls can be in flight at once (each read spawns a ~5s CLI). If poll B finishes with an authoritative failure (stop + clear `lastGood`) and a still-in-flight poll A then finishes `available: true`, `onGood` runs on the stopped poller and reinstates `lastGood`/`lastGoodAt` — permanently, since nothing will ever poll again. The envelope then shows a good reading on an account the poller just concluded has nothing to read — exactly the misrepresentation the authoritative branch exists to prevent. Requires overlapping polls with contradictory outcomes (e.g. auth state flipping mid-window), so it is rare; see Bugs.

## Functions (low-level)

- **`DEFAULT_POLL_MS` / `MAX_POLL_MS`** — 5m / 30m; doc rationale matches SPEC. Correct.
- **`QuotaEnvelope`** — `latest` vs `lastGood` split; the "bar going empty reads as nothing used" invariant is what the split serves. Correct.
- **`current()`** — shallow copy. Correct.
- **`intervalMs` / `isStopped` getters** — trivial. Correct.
- **`poll()`** — catch→fetch-failed, fold, branch on `available`. Verdict: correct except the stopped-race in `onGood` (below).
- **`onGood(quota)`** — sets `lastGood(At)`, resets interval; does not check `this.stopped`. Verdict: bug (minor) under the race above.
- **`onBad(reason)`** — records `lastFailureAt`; authoritative → clear + stop; transient → double capped. Correct.
- **`schedule()`** — stop-guard, self-rechaining timer, unref. The `this.timer = undefined` inside the callback's finally is cosmetic (the timer already fired) but harmless. Correct.

## Bugs found

1. `L123-L127` (`onGood`, with `poll()` L85-101): a success that resolves after an authoritative failure has stopped the poller resurrects `lastGood` on a permanently stopped poller. Scenario: the daemon's on-demand `poll()` (after a turn settles) overlaps the timer's poll; the later-started read returns `no-subscription` (stop, `lastGood` cleared), then the earlier-started read resolves `available: true` → `lastGood` is set again and never re-evaluated, so every surface reading `current()` shows a stale good number for an account the poller decided has nothing to read — contradicting the SPEC's "the retained reading is discarded, and polling ends". Severity: minor (narrow window, needs contradictory concurrent readings). Fix sketch: guard the fold — in `poll()` or `onGood`, return early when `this.stopped` (e.g. `if (this.stopped) return quota` before folding, or `if (this.stopped) return` at the top of `onGood`).
