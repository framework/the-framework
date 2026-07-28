Wires the quota boundary up for one run (#879): polls the wrapped agent's quota and returns the cheap between-turns gate that names the window that hit its limit.

## TLDR

- `startConsumptionGuard({driver, model})` → `{gate, poller, stop}`, or `undefined` when the driver has no `readQuota` (fake driver, or an agent without such a command).
- `gate()` answers from the `QuotaPoller`'s cached readings via `quotaBoundaryStatus` with the default half-day spend offset; returns the reached window's label, or null while there is room.

## Decisions

- The boundary is derived from the account's own reported week — a comparison of two numbers the agent reports, not a total we accumulate — so nothing to configure and nothing to remember between restarts.
- Fails open (no reading → work carries on), the fail-open Rom confirmed on #519 and the opposite of the auto-PM gate: this guards work the user asked for, and the per-run budget cap still sits underneath.
- The first quota read is deliberately not awaited: it spawns the whole agent CLI (~5s), and making every run wait that long to *maybe* learn it has budget is a poor trade — the reading lands a moment into the run.
- Uses `DEFAULT_SPEND_OFFSET` (the half-day cushion of #960), never the user's slider: the slider sets where *unattended* work stands down and must not tighten the gate on user-requested work. Without the cushion the continuous boundary starts the week at zero and the first integer percent the agent reports would pause the user's own first run of the week over ordinary rounding.
