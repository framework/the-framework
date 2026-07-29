`UsageMeter`: accumulates per-turn `DriverUsage` (tokens + cost + turn count) into a running total for the whole run, which the budget cap gates on (#322).

## TLDR

- `costUsd` starts absent rather than `0` and only appears once a turn reports a price: an agent that never prices a turn must not accumulate a total that reads as "this run was free" (#540). An unpriced turn still counts its tokens.
- Tracks what *this run* spent — a separate question from where the account's subscription quota stands, which the agent reports per turn as `DriverRateLimit` (#517). (An earlier note claimed the account limit was unreachable under subscription auth; it isn't.)
