Background poller that keeps a recent account-quota reading on hand for the daemon (#525), polling slowly and backing off on failure.

## TLDR

- `QuotaPoller.start()` reads immediately (a run that just started needs a baseline), then re-reads on a timer; `poll()` can also be called on demand (e.g. right after a turn settles).
- `QuotaEnvelope` separates `latest` (last attempt as-is) from `lastGood` (last successful reading), so a transient blip never blanks a number — an empty bar would read as "nothing used", the one thing this feature must never imply.
- Transient failure: keep `lastGood`, double the interval (up to `MAX_POLL_MS`). Authoritative failure (no subscription / no agent): clear `lastGood` and stop for good — asking again changes nothing.

## Decisions

- Deliberately slow (`DEFAULT_POLL_MS` = 5 min, ceiling 30 min): a read spawns the whole agent CLI (~5s), the agent's usage fetch is refused upstream when asked too often (penalty window is minutes long), and the boundary moves over days. An eager retry loop would keep the number permanently unavailable — the opposite of the goal.
- A driver that throws is folded into `{ available: false, reason: 'fetch-failed' }` — the same story as a reported failed fetch.
- The timer is `unref()`ed: the daemon's own work decides the process lifetime, not a quota read.
- `start()` does not await the first poll (~5s; nothing should wait on it). Idempotent; `stop()` idempotent too.

## Facts

- Transient vs authoritative is decided by `isTransientQuotaReason` from the driver layer.
- A successful read resets the backoff to the healthy interval.
