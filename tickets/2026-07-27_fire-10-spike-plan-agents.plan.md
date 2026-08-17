Effort: 1
Uncertainty: 2

# [Plan] Goal: fire 10 `Spike & plan` agents concurrently

The ticket is already implemented end-to-end; what remains is a verification run at full width and closing the ticket.

## TLDR

Every ask in the ticket — fan-out, per-ticket pinning, daemon-pushed locks, concurrency up to 10, Claude Web execution, the [Trigger routine now] path — has landed across #1204, #1209, #1210, #1320, #1327 and #1420. The strongest evidence is self-referential: this plan file was produced by exactly the pipeline the ticket describes (batch lock commit `a0b430e` on `main`, a fanned-out cloud session pinned to this one ticket, lock deleted in the same commit as the plan). The remaining work is to observe one batch at the full width of 10 and then close the ticket.

## Status: ticket ask → what shipped

- **Fan-out, one ticket per agent** — `AutoPmJob.fansOut` is declared on the `Spike & plan` rotation job, and `pinnedPlanJob()` appends the one-ticket pin and claim instructions to the stock prompt (`packages/the-framework/src/auto-pm.ts`). Candidates come from `planCandidates` (unplanned, unlocked tickets, most important first) wired in `daemon-services.ts`.
- **Lock mechanism** — implemented as `tickets/<STEM>.lock.md` holding `CLAIMED: <AGENT_ID>` (`packages/the-framework/src/ticket-locks.ts`), which #1420 chose over this ticket's original `PENDING:` placeholder files. The daemon writes the whole batch as one pathspec-scoped commit and pushes it to origin's default branch before any agent starts — exactly thread refinement 1 (agents can't push; the daemon locks the batch in one commit).
- **Staleness rule** — deliberately *not* the ticket's "PENDING + no PR + N minutes = reclaimable": #1420 dropped the timer because a legitimately long-running agent would have its ticket re-opened under it. A dead agent's lock is instead released by hand from the dashboard (`releaseTicketLock`). This supersedes thread refinement 2.
- **Concurrency = 10** — `autoPmConcurrency` preference (#1204), clamped to `MAX_AUTO_PM_CONCURRENCY = 10` (`preference-defaults.ts`). A batch fans out `concurrency - activeAgents` agents.
- **Routine limited to "Spike & plan tickets"** — the per-routine opt-outs (#1209): untick everything else and the rotation contains only `Spike & plan`.
- **Run on Claude Web** — the `target: 'web'` preference flows through `resolveProjectAgentOptions` → `startUnattended`, so routine agents honour it; #1320 (cloud sessions push and open PRs autonomously) is closed, unblocking delivery.
- **[Trigger routine now]** — the on-demand sweep (#1210): `tick({ onDemand: true })` runs with the master switch off, all other gates intact.
- **Prompt update** — the `Spike & plan` preset already excludes tickets with `.plan.md`/`.lock.md`, and the per-agent pin/claim epilogue is appended verbatim by `pinnedPlanJob`, so a rewritten preset cannot lose the pin.
- **Composes with #1316** — PR diffs claim work after a PR exists; these locks cover the window before. Both windows closed, as the thread agreed.

## Remaining work

1. **Observe one full-width batch.** Settings: run target Claude Web, all routines but `Spike & plan` opted out, concurrency 10, click [Run now]. Verify 10 locks land in one commit and 10 cloud sessions start. Note the batch deliberately stops at the first refused start, and it only fans as wide as there are unplanned, unlocked tickets — a 3-agent batch with 3 candidates is correct behaviour, not a bug.
2. **Watch the lock lifecycle at scale.** Each plan PR must delete its own lock alongside the plan it lands; after the batch's PRs are reviewed, confirm no orphan `.lock.md` files remain (a closed-without-merge PR leaves one, to be released from the dashboard — by design).
3. **Close the ticket** (delete `tickets/2026-07-27_fire-10-spike-plan-agents.md` and this plan, close #1327) once a full-width batch has been seen. No code change is expected.

## Considerations

- `DEFAULT_AUTO_PM_COOLDOWN_MS` (30 min) staggers consecutive batches per project; the quota boundary (#879) can legitimately stand a batch down.
- Candidates are ranked by the ticket's `Priority:` header, so "most important first" is only as good as the priorities on the tickets.
- If a full-width run surfaces a defect (e.g. cloud-session start refusals under a 10-wide burst), that is a new, narrower ticket — this one's scope is delivered.
