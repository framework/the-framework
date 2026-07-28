Auto PM (#685): pure policy + sweep loop that spends leftover subscription quota on the project's own roadmap while nobody is at the keyboard — draining the agent queue (`TODO_AGENTS.md`, #855) and, once dry, refilling it via a triage/plan rotation, all under the quota boundary (#879).

## TLDR

- `autoPmDecision()` / `quotaHeadroom()` — pure per-project policy, cheapest check first: enabled → concurrency cap (#1204) → cooldown → queue readable → quota headroom; yields `{start, mode: 'drain'|'pm'}` or a refusal whose reason reads as a sentence.
- `AUTO_PM_JOBS` — the idle rotation, cheapest-and-readiest first: triage-quick (#891), triage-consensual (#892), spike-and-plan. `AUTO_PM_DRAIN_JOB` (#855) and the calendar-paced `AUTO_PM_MAINTENANCE_JOB` (#882) sit outside it; `AUTO_PM_ROUTINES` derives the dashboard list from all of them so screen and daemon cannot drift (#1159).
- `pinnedDrainJob()` — a drain rewritten to one named queue entry, with a stop-if-gone guard (#1204).
- `startAutoPm(deps)` — the tick loop: promote finished runs' queues (#852), decide per project, pick the job, fan drains out to concurrency, log and record an `AutoPmReport` (#1161). Every reading/effect is injected via `AutoPmDeps` so the loop tests off disk.

## Problems

- Unattended deadlock (#855): PM jobs filled the queue and nothing drained it (the backlog loop only exists inside a human-started run), so a non-empty queue now *starts* a drain rather than refusing.
- Promotion staleness (#852): a run's queue lives on its own worktree branch, so until promoted the checkout reads empty and the sweep would re-derive the same work every cooldown; a tick that lands a queue stops there and re-reads next tick.
- Duplicate assignment (#1204/#1253): every unpinned drain forks the same checkout and reads the same first entry. Guards: in-memory pins on in-flight runs, plus durable claims (run meta / open PRs) for runs the loop never started, forgot across a restart, or whose local process ended at the web hand-off.
- Stop mid-sweep (#983): everything is awaited, so `stopped` is re-checked after the reads and per spawn (break, not continue — stopping is a verdict on the whole sweep); a run spawned past `stop()` would be an orphan no live-run map tracks.
- A tick landing before a spawn registers in the live-run map would double-start; the per-project cooldown covers that window, armed once per batch before the first spawn, and given back when nothing started.

## Decisions

- `quotaHeadroom` fails CLOSED on an unreadable quota — the deliberate opposite of the per-run guard's fail-open (#519): quietly burning a subscription on work nobody asked for is worse than skipping a tick. Reading the account's absolute week also un-blinds a restarted daemon (#848, vs the old delta meter).
- An unreadable queue is its own refusal — neither empty nor full — since both real answers now start something (#855).
- Refusals name the actual line/cap ("your 39% limit (+7.1 on the week's 32%)", "at most 2 at once") so a moved slider or raised setting does not read as a bug (#960/#1204); offsets round to one decimal.
- The rotation advances only on a start that took (a refused job is retried, not skipped); draining and the maintenance sweep never advance it. The sweep stamps its own calendar instead — and only after the start took.
- Only draining fans out: every rotation job rewrites the whole queue file from the same fork point, so two at once would have the later promotion revert the earlier; the rotation stays one run per tick however high the concurrency (#1204).
- Opt-outs (#1209) filter the rotation (remaining jobs alternate) rather than skipping at the index; an opted-out drain with work waiting stands the sweep DOWN (inventing more work is the opposite of what was asked); an opted-out maintenance sweep leaves its calendar untouched so it comes due when re-ticked.
- Fail-safe polarities: unreadable opt-outs = none, unreadable concurrency = the default (never one), unreadable claims = unclaimed, unreadable `maintenanceDue` = not due — one bad read must not shrink, stall, or fire the routine.
- On-demand ticks (#1210) skip only the master switch (the click is the consent the preference records); every other stand-down holds. `drainOnly` (#1204) never borrows the click for a rotation job.
- A start refusal ends the batch — whatever refused this start will not take the next a moment later.
- The first sweep is the caller's to fire, not the constructor's: `tick` marks the loop busy synchronously, so a constructor-fired sweep would make every test's first `tick()` a no-op.
- Triage jobs declare `pinnedBranch` as data (#1293) so the sweep releases a stale branch (its PR closed/merged) before firing, without matching on job names at the call site; a failing release leaves the job's own abort guard to decide.

## Facts

- Defaults: tick every 10 min, per-project cooldown 30 min; concurrency floors at 1 (zero is what `enabled: false` spells) and defaults to `DEFAULT_AUTO_PM_CONCURRENCY`.
- The gated triage preset (#698) is deliberately absent from the rotation: it ends in `<AWAIT>` and would park a run against a human who never answers.
- Ticks never overlap (`sweeping` flag); the interval timer is `unref`ed; nothing survives the daemon (#519 — Ctrl+C stopping everything is the feature).
- The quota is read once per sweep (account-wide, rate-limited call); preference/opt-out/concurrency are re-read per tick so toggles take effect without a restart.
- `report()` (#1161) exists because the log is daemon stdout while the toggle is a browser: a wedged sweep and a healthy idle one looked identical from the dashboard. `nextSweepAt` counts from the start anchor so an out-of-band tick cannot skew it; `enabled` is recorded even on early return.
- The maintenance job renders at module load with no session, so `tf.params.what` falls back to "entire codebase" — exactly its scope (#882).

## Flows

- tick: enabled? → per project: promote pending runs (#852; anything landed ⇒ note and stop here) → read queue + activeRuns → `autoPmDecision` → drainOnly / opted-out-drain guards → maintenanceDue? → job = sweep > drain > rotation[index] → drain: filter assigned + durably-claimed entries, pin up to `concurrency − activeRuns` → per job: `releasePinned?` → `start()` → track in `pending` → advance rotation / stamp sweep → note outcome.
- report: `report()` → last sweep's `enabled`/`sweptAt`/`outcomes` + anchored `nextSweepAt`.
