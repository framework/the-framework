The Overview's "Routine work" card (#1159): lists the auto-PM jobs the idle sweep fires on schedule, each with a Run now button, plus the auto-run master switch, per-routine opt-outs, concurrency setting and an on-demand sweep trigger.

## TLDR

- The list IS `AUTO_PM_ROUTINES` from the browser-safe `@gemstack/the-framework/client` entry — no read of its own, so screen and daemon cannot drift.
- Run now on a rotation job: `useStartRun().start(projectId, job.prompt, 'prompt', {...runOptionsFromPreferences, unattended: true})`, then `onRunStarted(projectId, intent, runId)` so the shell selects the run just started (#1191).
- Run now on the drain job (`job.drains`): `sendAutoPmSweep({ drainOnly: true })` instead — only the sweep can fan out one agent per queue entry up to the concurrency (#1204); no navigation, the batch lands in the Agents card.
- Two checkbox tiers (#1209): the foot box is the global `autoPm` preference (#685, schedule on/off); each row's box is that routine's membership, stored as `autoPmOptOut`.
- "Trigger routine now" (#1210) fires `sendAutoPmSweep()` on demand, live even with auto-run off (the click is the consent); failure note when the host isn't running the sweep (the relay serves this same dashboard).
- The sweep's own answer lands in the note slot (#1433): the RPC awaits the tick and returns per-project outcomes — one project speaks its message plainly, several are prefixed by folder name (` · `-joined); "Triggering…"/"Starting…" holds until the tick resolves. Outcomes missing on an ok answer reads "The sweep ran."; an empty list "…considered no projects." Applies to both the trigger button and the drain's Run now.
- `autoPmConcurrency` number input (#1204), clamped 1..`MAX_AUTO_PM_CONCURRENCY`; project picker only when >1 project.

## Decisions

- Opt-*out* is recorded, never opt-in: every routine defaults on, so a routine added by a later version runs for someone who saved settings before it existed.
- Concurrency default shows `DEFAULT_AUTO_PM_CONCURRENCY` (not 1) so the number on screen is the number the sweep would use.
- Card-fired routines run `unattended` (#1279): gates auto-answer, run ends at settle, armed handoff fires — same as the sweep's own runs, instead of parking in the stay-open chat loop.
- Auto-run label shows a countdown (`Auto-runs in …`) only when auto-run is on AND the sweep has reported `nextSweepAt` — no invented countdown.
- Run now ignores the row checkbox: it fires the routine once, whatever the schedule says (#1209).

## Facts

- `NO_PROJECTS` is a module-level constant because `useLoaded` treats a fresh `[]` literal as a new value each render.
- Empty concurrency input is ignored (`Number('')` is 0, not NaN — the clamp would turn a cleared field into a saved 1).
- Stale project picks are validated against the loaded list; fallback is the first project.
- Warning shown when auto-run is on but every routine is opted out — a countdown to nothing (#1209).
