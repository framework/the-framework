# Bug analysis: packages/framework/src/auto-pm.ts

## Business logic (high-level)

Auto PM: the pure policy (`quotaHeadroom`, `autoPmDecision`), the job catalog
(`AUTO_PM_JOBS` / drain / maintenance / `AUTO_PM_ROUTINES`), the prompt pinning
(`pinnedDrainJob`, `pinnedPlanJob`), and the sweep loop (`startAutoPm`) that drains the queue,
rotates the refill routines, fans out with cross-machine ticket claims, holds routine locks,
promotes finished agents' queues, frees dead claims, and reports one sentence per project.
`auto-pm.SPEC.md` is unusually detailed; I checked each of its sections against the code.

Verified against the SPEC (all hold):

- **Fail closed on unreadable quota / queue**; queue picks the job; unticked drain falls through
  to the rotation while a drain-only click stands down instead.
- **Rotation** advances only on a start that took; draining and named clicks never advance it;
  filtered (not index-skipped) by the opt-outs; `rotation[index % rotation.length]` with an empty
  rotation indexes with NaN → `undefined` → the "every routine … switched off" stand-down (no
  crash).
- **Maintenance** asked only when the routine is on (`maintenanceJob !== undefined &&` short-
  circuits before `maintenanceDue`), only while the queue is *genuinely* empty
  (`decision.mode === 'pm'`, deliberately not the fall-through `mode`), stamped only when a start
  took — except for one gap, Bug 1 below.
- **Concurrency/cooldown**: cap re-read per sweep, floored at 1; cooldown armed once before the
  first spawn, given back when nothing started; `onDemand` skips only the master switch and the
  cooldown.
- **Fan-out**: drain pins entries (in-flight `pending` + `endedDry` filtered), slices to
  `concurrency - activeAgents`; ticket-linked entries get pushed `.lock.md` claims matched back by
  agentId so two entries linking one ticket cannot both carry it; a lost race drops the entry, an
  all-lost batch stands down. Plan fan-out needs both seams, filters pinned+dry tickets, empty
  candidates advance the rotation (unless a click named it), zero locked falls back to the stock
  single agent.
- **Stop is a verdict on the whole sweep**: re-checked before arming and per spawn; claims of
  never-started items are released after the loop (also on the stop path).
- **Routine locks**: taken before the start, given back on a refused start, released at settle
  whatever the ending, failed releases retried bounded by `waits`, dead locks released on the
  project's first sweep only.
- **Promotion first**: a landed queue ends the project's tick; a settled `no-commits` claim is
  remembered dry *before* the release is attempted; the mid-epilogue hold and the release retries
  share the bounded `waits` counter.
- **Report**: recorded in `finally` even on early return; `nextSweepAt` anchored at `startedAt` so
  out-of-band ticks cannot skew it; overlapping/stopped ticks are no-ops.

Concurrency/ordering concerns examined: the `sweeping` flag makes ticks mutually exclusive (an
on-demand click during a running sweep is silently dropped — deliberate per "sweeps never
overlap", though the click gives no feedback; noted, not reported). `pending`, `endedDry`,
`nextJob`, `lastStart` are per-project maps mutated only inside the serialized tick. Duplicate
queue-entry *texts* would conflate in the `assigned`/`dry` sets and in the pin itself — inherent
to entries being free text; the pinned prompt is by text anyway, so this is not actionable.

## Functions (low-level)

- **`quotaHeadroom(quota)`** — undefined → refuse (fail closed); `reached` → sentence naming the
  window, its % used, the boundary day, and the line (week % or user limit with the offset
  rounded to one decimal, `+` prefixed only when positive — negatives carry their own sign).
  Verdict: correct (wording pinned by tests).
- **`autoPmDecision(input)`** — order: enabled → cap (names the runs; singular wording preserved
  at cap 1) → cooldown (skipped `onDemand`) → unreadable queue → quota → mode. `concurrency`
  floored at 1 via `Math.max(1, Math.floor(...))` (NaN input would yield NaN → `activeAgents >=
  NaN` false → effectively unlimited; callers only pass numbers or undefined, reliance noted).
  Verdict: correct.
- **`pinnedDrainJob(job, entry, assignment?)`** — pins the entry, forbids the check-off, tells
  the agent to stop on a retired entry; with a claim, names the lock file and the CLAIMED id and
  the three siblings to remove. `stem` strips a trailing `.md` only. Keeps `autoMerge` via
  spread. Verdict: correct.
- **`entryPreview(entry)`** — whitespace-flattened, 80-char cap with ellipsis. Correct.
- **`pinnedPlanJob(job, assignment)`** — appends (never splices) the narrowing and the claim
  contract; sets `ticket` and `claim`. Verdict: correct.
- **`AUTO_PM_JOBS` / `AUTO_PM_DRAIN_JOB` / `AUTO_PM_MAINTENANCE_JOB` / `AUTO_PM_ROUTINES`** —
  order, locks on the two triages, `fansOut` only on plan, `autoMerge`+`drains` only on drain,
  all pinned by tests. Prompts render at module load; `maintenance.render()` with no session
  falls back to whole-codebase scope (test-pinned). Correct.
- **`startAutoPm(deps)` / `tick`** — the loop. Detailed findings:
  - Promotion loop: `promote` rejection → treated still-pending (retried; unbounded but promote
    failures are transient reads — reliance noted). The `handoffPending` hold applies only to
    agents with a claim or a pinned entry (per SPEC); lock-only triage agents settle immediately
    and release their routine lock. The `endedDry` record is gated on `agent.claim &&
    deps.releaseLock` — Bug 2 below. Failed `releaseLock`/`releaseRoutine` retried while
    `waits < 2`; the same counter also counts the mid-epilogue hold, so a claim held two sweeps
    for the epilogue gets no release retry budget afterwards — the SPEC says "bounded like the
    hold above", so sharing is arguably intended; noted only.
  - Drain-only / plan-only / lock-named narrowing: stand-down wordings distinguish "switched off"
    from "no routine holds that lock"; a named click never drains, never advances the rotation.
    Correct.
  - The `sweep` flag is computed regardless of `named` and later drives `recordMaintenance` —
    Bug 1 below.
  - Start loop: lock taken per item before its spawn; refused start ends the batch and returns
    the just-taken lock; started items enter `pending` with entry/ticket/claim/lock; claims of
    never-started items are released afterwards (they never enter `pending`). Correct.
  - `if (!batch.length)` (all drain claims lost) is also reached when `lockDrains` *threw*
    (caught → `[]`); the message then blames "another agent already claimed" rather than the
    write failing. Cosmetic; noted only.
  - Cooldown handed back on a batch that started nothing (unless stopped). Correct.
- **`nextSweepAt` / `report()` / `stop()`** — anchored schedule, report assembled from
  `lastSweep`, stop just flips the flag (checked at loop boundaries). Correct.

## Bugs found

1. `L1130` (cause at L937-943): **a Run-now click that names a routine stamps the maintenance
   calendar without running the sweep.** `sweep` is computed from queue-emptiness + due-ness alone;
   `job = named ?? (sweep ? maintenanceJob : …)` gives the tick to the named routine, but
   `if (started.length) { if (sweep) await deps.recordMaintenance(...) }` still fires. Scenario:
   the queue is empty, the periodic maintenance sweep is due, and the user clicks Run now on
   planning (`only:'plan'`) or a triage (`only:{lock}`); the plan/triage agent starts and
   `recordMaintenance` stamps `sweptAt` — the maintenance sweep is silently postponed a whole
   calendar interval although its agent never started. Contradicts the SPEC ("It stamps its own
   schedule when its agent actually starts") and the intent pinned by the test "a sweep is
   stamped only when the run actually started". Severity: major. Fix: compute
   `const sweep = !named && decision.mode === 'pm' && …` (which also spares the `maintenanceDue`
   read on a named click), or guard the stamp with `sweep && !named` / `job === maintenanceJob`.

2. `L814-819`: **a ticketless queue entry whose drain ends `no-commits` is respawned every
   cooldown, forever.** The `endedDry` record sits inside `if (agent.claim &&
   outcome.handoffSkip === 'no-commits' && deps.releaseLock)`, so a drain agent pinned to an
   entry that links no ticket (`agent.entry` set, `claim` undefined) is never remembered. The
   daemon's `promote` (daemon-services.ts L303) retires an entry only when the run *published*,
   so the commitless entry stays open on the queue; the next sweep's `open` filter finds it
   unassigned and not-dry and starts another agent — one quota-funded agent per cooldown, the
   exact livelock the SPEC's rationale describes ("a deterministically commitless job respawn
   every cooldown, forever"), and the glossary's "ended dry" definition carries no
   claim qualifier. Severity: major. Fix: record the dry work whenever
   `outcome.handoffSkip === 'no-commits'` and the agent has an `entry` (or `claim`), independent
   of `agent.claim`/`deps.releaseLock`; keep only the release call under the claim guard.
