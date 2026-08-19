Effort: 3
Uncertainty: 4

# [Plan] Setting to set number of concurrent agents — the remaining open question

How the `autoPmConcurrency` setting should drive per-routine "Run now" clicks, and which routines actually fire on auto-run: the first is a small generalization of an existing seam, the second is already answered by the code and only needs saying.

## TLDR

The setting itself is done and verified (see the ticket's Verification section). Two threads remain:

1. **"Which routine tasks are triggered when the routine is auto-run?"** — fully answerable today from `packages/the-framework/src/auto-pm.ts`; the deliverable is the answer (below) plus, optionally, surfacing it on the routines card.
2. **"Run now on e.g. quick-wins should lead to the max number of concurrent agents"** — partially done, partially impossible as literally stated:
   - The **drain** row's Run now already fans out to the concurrency (`sendAutoPmSweep({ drainOnly: true })`, #1204).
   - **[Plan tickets]** fans out on auto-run (#1327, `fansOut: true` + `.lock.md` claims) but its Run now still bypasses the sweep and starts one stock agent — this is the concrete gap to close.
   - The **triage routines (quick-wins, consensual)** cannot fan out at all: each copy rewrites the whole `TODO_AGENTS.md`, so concurrent copies revert each other (the exact reason #1327 gave only `[Plan tickets]` the `fansOut` flag). For these, "max concurrent agents" can only mean *the pipeline* — triage fills the queue, then the drain fans out — which auto-run already does across ticks.

Proposed implementation: generalize the sweep's `drainOnly` narrowing to a per-routine narrowing (`only: <job.name>`), and route Run now through it for every routine that can fan out (`drains` or `fansOut`). Single-agent routines keep their current direct start.

## Answer: what auto-run actually triggers

The sweep (`startAutoPm` in `auto-pm.ts`) ticks every 10 minutes per project, and each tick starts at most one *kind* of work, chosen by precedence:

1. **Queue non-empty → drain.** Fans out: one pinned agent per open entry, up to `concurrency − activeAgents` (#1204). Auto-merges its PRs (#1216).
2. **Queue empty + maintenance due → maintenance sweep.** Single agent, calendar-paced (#882); outranks the rotation.
3. **Queue empty otherwise → the rotation**, one job per tick, cycling per project: *Import/update tickets* (#1208) → *Add quick-win work to AI Queue* (#891) → *Add consensual work to AI Queue* (#892) → *Plan tickets* (#685). Only *Plan tickets* fans out (#1327), pinning one locked ticket per agent up to the same cap; the others are strictly one agent per tick, guarded by pinned branch names against overlapping firings.

So on auto-run *every* routine listed on the card eventually triggers; concurrency applies to draining and planning, and cannot apply to the queue-rewriting jobs. This paragraph (suitably placed) is the answer the ticket asks for.

## Problems

1. **What should the triage rows' Run now do about concurrency?** (uncertainty 6 — the thread's literal ask is unsatisfiable)
   - The prompt rewrites one shared file; N concurrent copies fork the same checkout and revert each other's edits. Fanning them out is wrong, not just unimplemented.
2. **Should Run now for fan-out-capable routines go through the sweep, and what does that change?** (uncertainty 3)
   - Going through the sweep buys the fan-out, the pending/lock bookkeeping, and the outcome report — but also its gates. On-demand sweeps already skip only the master switch; the quota boundary, cooldown, and active-agent cap still hold. For the drain row that trade was accepted in #1204; extending it to [Plan tickets] is consistent, but note it makes a Run now click refusable (e.g. "a run was started a moment ago") where the current direct start is not.
3. **Where should the "what runs on auto-run" answer live?** (uncertainty 3)

## Solutions

**Problem 1 — triage Run now:**
- *(a) Leave as-is and say so (recommended).* One agent per triage click, by design; document it in the row's tooltip. The 10-parallel-demo path is: triage (fills the queue) → drain's Run now (fans out). Both buttons exist today.
- *(b) Chain on demand:* triage Run now runs the triage agent, and when its queue promotion lands, an on-demand drain-only sweep fires automatically. Gets "one click → eventually N agents", but adds a cross-tick trigger with no user watching the middle step; the auto-run sweep already does exactly this chain unattended, so the added machinery buys little.
- *(c) Redesign triage output to per-ticket sibling files so it can fan out.* Correct long-term if triage ever needs to scale, but a queue-format change touching every consumer of `TODO_AGENTS.md` — far out of proportion to this ticket.

**Problem 2 — fan-out Run now for [Plan tickets]:**
- *(a) Generalize the narrowing (recommended).* Replace/extend `tick({ drainOnly })` with `tick({ only?: string })` naming a routine by `AutoPmJob.name` (keep `drainOnly` as an alias or migrate the two call sites). Behavior for `only`:
  - the drain job → exactly today's `drainOnly` path;
  - a `fansOut` job → skip the queue-picked mode and run the plan-candidates → `lockPlans` → `pinnedPlanJob` batch path even when the queue has entries (the click asked for planning, not for whatever the queue-mode decision would pick);
  - any other job → refuse with a reason (single-agent routines keep the direct-start path in the dashboard, so this arm should be unreachable from the UI).
- *(b) A separate RPC for "fan out planning now"* — a second entry point duplicating the sweep's locking and pending bookkeeping; rejected, the sweep is the one place that may fan out.

**Problem 3 — where the answer lives:**
- *(a) Tooltip/description on the routines card (recommended):* the card already renders `AUTO_PM_ROUTINES` in precedence order; add a line under the card ("When auto-run is on: queued work first, then one of these per tick; ⇄-marked routines fan out to the concurrency") and mark the fan-out-capable rows.
- *(b) Docs only* (`auto-pm.SPEC.md` already largely says it) — cheapest, but the question came from the UI, so the UI is where the answer is missing.

## Implementation

1. `auto-pm.ts`: extend `AutoPmLoop.tick` opts with `only?: string`; inside the sweep, when `only` is set, resolve the named job from `deps.drainJob`/`deps.jobs`, honor its opt-out checkbox the way `drainOnly` does, and dispatch per Problem 2(a). Keep `drainOnly` working (map it to `only: <drain name>`), or migrate its two call sites (`daemon-services.ts:426` wiring, `RoutineWork.tsx:123`) and drop it.
2. `daemon-services.ts` / `dashboard-rpc/quota.ts`: thread the new option through `wakeAutoPm` and `sendAutoPmSweep` (both are thin pass-throughs).
3. `RoutineWork.tsx` `runNow`: `if (job.drains || job.fansOut)` → `sendAutoPmSweep({ only: job.name })`, keeping the existing outcome-note rendering and no-navigation behavior; other jobs unchanged.
4. Routines card copy (Problem 3a): one caption line + a marker on fan-out rows; tooltip on triage rows noting they are single-agent by design.
5. Tests, mirroring the existing #1204 coverage: `auto-pm.test.ts` — `only` on a fansOut job fans out to `concurrency − active` with locks even when the queue is non-empty, refuses non-fan-out names with a reason, respects opt-out; `RoutineWork.test.tsx` — [Plan tickets] Run now calls `sendAutoPmSweep({ only: 'plan-tickets' })` and does not call `start`; `daemon-services.test.ts` — the option survives the wiring.
6. Close the ticket (delete `tickets/2026-07-25_concurrent-agents-setting.md` and this plan) once the above lands — the setting itself needs no further work.

## Considerations

- **On-demand still respects quota/cooldown/cap.** Extending the sweep path to [Plan tickets] means its Run now inherits the drain row's semantics: the click skips only the master switch. Consistent, but a visible behavior change from today's always-starts direct start — the outcome note ("standing down — …") is what keeps it legible.
- **Lock hygiene rides along for free.** Routing plan fan-out through the sweep reuses `lockPlans`/`planCandidates`, so an on-demand batch gets the same `.lock.md` claims as an auto-run one; a bespoke path would have had to reimplement them.
- **Out of scope, but flagged by the verification and worth their own tickets** (the ticket says "worth a decision alongside the open question"):
  - the 30-minute cooldown is stamped once per batch, so a short batch is not topped up when the queue grows right after;
  - hands-off web runs leave `activeRunCount` early, so a later batch can exceed the cap (over-fans, never duplicates — #1253 claims hold).
  Neither changes the design above; recommend spinning each off rather than widening this ticket.
