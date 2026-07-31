The usage panel's telefunctions (#533): subscription quota standing, auto PM's last decision, and firing a sweep on demand.

## TLDR

- `onQuota`: the daemon-polled `QuotaView` (#533/#879); unwired or failing sources return `{ windows: [], unavailable: 'fetch-failed' }`.
- `onAutoPm` (#1161): what the auto-PM loop last decided, for the line under the panel's toggle; `undefined` on a host with no sweep so the panel says "nothing to say" rather than "idle".
- `sendAutoPmSweep` (#1210): trigger a sweep now instead of waiting for the interval; `drainOnly` narrows it to working the queue (#1204). Awaits the tick and returns the report's per-project `outcomes` (#1433) — the click used to be fire-and-forget, so the card had nothing to show and the stand-down reason was recoverable only from the source. `ok: false` = no loop on this host (the relay) or the sweep threw; `ok` without `outcomes` = the sweep ran but its report was unreadable.

## Decisions

- The empty quota view carries no windows and no boundary rather than zeroes: an empty bar reads as "nothing used", the one thing this panel must never imply.
- The `autoPm` preference does not gate a manual sweep: the preference is consent to spend quota *unasked*, and this call is asking — with auto-run off the daemon still sweeps once (all other stand-down reasons in force), which replaces the old off-and-on-again trick.
