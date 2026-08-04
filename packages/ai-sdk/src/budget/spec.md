Per-user USD budget enforcement around agent runs: a middleware that pre-debits an estimate before every model call and trues up from real usage after.

## Decisions

- **Pre-debit, then true-up** is what makes concurrency safe: the storage contract's check-and-debit is atomic, otherwise a user exceeds the cap by cost × concurrency. The true-up passes an unbounded cap — the response already streamed and cannot be unspent; enforcement already happened at pre-debit.
- **Fails loud on unpriced models** — silently zero-costing a typo'd model is the worst outcome for a budget guard. But the true-up fails soft if the rate vanished mid-run (a failover model swap) rather than throwing after the fact.
- A null user bypasses enforcement (unauthenticated/admin paths).

## Facts

- Known caveats, documented: no refunds on error; cache tokens aren't discounted (usage carries no cache fields yet); the default estimator is chars/4; the pre-debit runs before per-step model swaps are visible.
- The pricing table is dated per model; period keys make storage per-user-per-period.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
