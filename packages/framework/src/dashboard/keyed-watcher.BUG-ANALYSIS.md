# Bug analysis: packages/framework/src/dashboard/keyed-watcher.ts

## Business logic (high-level)

The daemon-side notification engine (#627): a poll over a cross-project projection that announces only genuinely new items, once, to `onNew` (Discord in production). Two instances run — interventions ("needs you") and activity — parameterized by `build`, `keyOf`, `scopeOf`. Invariants per the SPEC:

- an item is announced at most once (identity = `keyOf`);
- items existing before a project's first *whole* read are never announced (per-project baseline, #1623);
- a failed or partial read announces nothing for the unread projects and earns them no baseline, but everything actually seen is still recorded;
- polls never overlap; stop() ends polling and suppresses an in-flight announcement;
- no timer of its own — the daemon tick calls `poll()` (verified: `daemon-services.ts` L516 `for (const w of discordWatchers) await w.poll()`, and `daemon-tick.ts` catches a rejected `run()`, so a rejected `poll` is logged, not fatal).

Concurrency/ordering: `running` guards re-entrancy (a second `poll()` during an in-flight one is dropped, not queued — acceptable for a periodic tick). `stopped` is checked before calling `onNew`, satisfying "stopping ... ends any announcement in flight". Failure of `projects()`/`build()` is caught and yields nothing (matches SPEC "failures cost nothing"). An `onNew` rejection escapes `poll()` — the callers in `daemon-services.ts` catch their own delivery failures (`.catch(() => false)`), and the tick catches the rest, but the items were already folded into `seen`, so a failed delivery permanently loses that notification. That is consistent with the forgiving design (no retry promised), noted as a reliance, not a bug.

One gap found: `SeenTracker.observe` deduplicates across polls but not within one poll's batch (see Bugs).

## Functions (low-level)

- **`SeenTracker.observe(items, whole)`** — filters `items` to those whose scope is already warmed up and whose key is unseen, *then* folds all keys into `seen` and all `whole` projects into `warmedUp`. The order is what makes a project's first whole read a silent baseline (its scope is not yet warm during the filter) — correct, and pinned by the tests. Partial-read items are recorded but can also be *announced* if their project earned its baseline earlier; that is sound (a partial read can under-report, never invent). Edge: two items in the same batch with the same key (reachable: two registered checkouts of one GitHub repo both list the same PR; `interventionKey` is the PR URL) both pass the filter, because `seen` is only updated after filtering → both are handed to `onNew` in one call. Verdict: bug found (within-batch duplicate), otherwise correct.
- **`startKeyedWatcher(opts)`** — builds the tracker, wires `poll`. `if (stopped || running) return`; `build(await projects())` in an inner try/catch returning silently; `observe`; `onNew` only when fresh and not stopped; `finally { running = false }`. Verdict: correct.
- **`KeyedWatcher.stop`** — sets the flag only; the in-flight poll finishes its read but will not announce. No unsubscribe needed (no timer). Verdict: correct.
- **Interfaces (`KeyedWatcherOptions`, `ProjectionRead` usage)** — `whole` as `Iterable<string>` matches `ProjectionRead.whole: string[]`. Correct.

## Bugs found

1. `L39` (`SeenTracker.observe` filter): duplicate keys within one poll's batch are all announced. Scenario: the user registers two checkouts of the same repository (a supported setup — overview/open-questions explicitly dedupe for it); a new PR opens; the next interventions poll carries the PR once per project (same `interventionKey`, the PR URL, different `scopeOf`), both copies pass the `!seen.has(key)` filter, and the single Discord "needs you" message lists the same PR twice. Contradicts the SPEC's "notified about each of them exactly once". Severity: minor. Fix: dedupe inside the filter with a batch-local `Set` of keys (skip an item whose key was already accepted this batch).
