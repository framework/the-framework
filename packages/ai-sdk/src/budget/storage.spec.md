`BudgetStorage` persistence contract for the budget middleware (#A6 Phase 2), plus the in-memory reference implementation and the period-bucketing helper.

## TLDR

- `BudgetStorage.checkAndDebit(opts)` — atomically read current spend, add `costUsd` if the result stays within `cap`, return `{ allowed, spent, cap }`; `costUsd: 0` is a pure read. Optional `reset()`.
- `periodKey(period, now, timezone?)` — buckets a `Date` into `YYYY-MM-DD` (daily) or `YYYY-MM` (monthly) in an IANA timezone (UTC default); exported so admin dashboards/tests bucket identically.
- `memoryBudgetStorage()` — `Map`-backed single-process implementation; validates `cap`/`costUsd` are non-negative finite numbers.

## Problems

- `checkAndDebit` MUST be atomic: without it two concurrent requests both pass the check before either debits, and a user can exceed the cap by `costUsd × concurrency`.

## Decisions

- The memory impl gets atomicity from JS single-threaded execution — a code comment explicitly forbids introducing `await` between the `Map.get` and `Map.set` (e.g. for logging), which would silently break the invariant.
- Calendar-period rollover only (daily at local midnight per `timezone`, monthly at month boundary); rolling-30-day windows were rejected as storage complexity for marginal value.
- `en-CA` locale is used with `Intl.DateTimeFormat` because it reliably formats `YYYY-MM-DD`.

## Facts

- On `allowed: false` the returned `spent` is the value BEFORE the rejected debit (what `BudgetExceededError` should report); on `allowed: true` it includes `costUsd`.
- The composite map key is `` `${userId}\0${period}\0${periodKey}` `` with literal NUL delimiters (invisible in most editors) to avoid collisions from user ids containing separator chars.
- Cross-process caveat: memory counters are process-local — queue workers / horizontal scaling need `ormBudgetStorage()` (Phase 4, lives in `@rudderjs/ai`, using `UPDATE … RETURNING` / `SELECT … FOR UPDATE`) or a Redis `INCRBY`-style impl.
