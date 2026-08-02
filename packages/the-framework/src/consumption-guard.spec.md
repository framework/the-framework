Wires the quota boundary up for one run (#879): polls the wrapped agent's quota and returns the cheap between-turns gate that names the window that hit its limit.

## TLDR

- `startConsumptionGuard({driver, model, limitOffset})` → `{gate, poller, stop}`, or `undefined` when the driver has no `readQuota` (fake driver, or an agent without such a command).
- `gate()` answers from the `QuotaPoller`'s cached readings via `quotaBoundaryStatus` with `max(DEFAULT_SPEND_OFFSET, the user's slider)`; returns the reached window's label, or null while there is room.
- `limitOffset` is an async supplier of the #960 slider value (cli.ts reads `preferences.autoSpendOffset` from the registry, the same source the daemon's quota bar reads). The gate stays synchronous: the supplier is refreshed in the background around each check and the check uses the last value that landed — one turn behind at worst, so dragging the slider unblocks a parked run's next boundary check without a restart (#1490).

## Decisions

- The boundary is derived from the account's own reported week — a comparison of two numbers the agent reports, not a total we accumulate — so nothing to configure and nothing to remember between restarts.
- Fails open (no reading → work carries on), the fail-open Rom confirmed on #519 and the opposite of the auto-PM gate: this guards work the user asked for, and the per-run budget cap still sits underneath.
- The first quota read is deliberately not awaited: it spawns the whole agent CLI (~5s), and making every run wait that long to *maybe* learn it has budget is a poor trade — the reading lands a moment into the run.
- The user's slider joins the gate only when it LOOSENS it (#1490): `max(DEFAULT_SPEND_OFFSET, slider)`. Raising the limit must unblock the runs the Usage bar says have room — the bar and the gate disagreeing is the exact thing #960 forbids (before #1490, the guard hard-coded the default and a run paused on a window the bar showed as fine). Lowering it sets where *unattended* work stands down and must never tighten the gate on user-requested work — the default half-day cushion stays the floor: without it the continuous boundary starts the week at zero and the first integer percent the agent reports would pause the user's own first run of the week over ordinary rounding.
