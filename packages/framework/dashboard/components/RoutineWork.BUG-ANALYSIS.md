# Bug analysis: packages/framework/dashboard/components/RoutineWork.tsx

## Business logic (high-level)

The Overview's "Routine work" card (#1159). Checked against its (long) SPEC:

- **The card is the daemon's own list**: rows map `AUTO_PM_ROUTINES` from the browser-safe client
  entry — no copy. No-projects state renders exactly "Add a project to run a routine." Holds.
- **Run now takes the right path per routine**: `narrowedSweep` dispatches on the job's own
  declarations (`drains` / `fansOut` / `lock !== undefined`), never the name; drain carries no
  projectId, the other two carry the picked project; everything else is a direct
  `start(projectId, job.prompt, 'prompt', {…preferences, unattended: true})`. Verified the
  declarations are mutually exclusive in auto-pm.ts, so the dispatch order cannot misroute.
  Direct-start navigation hands `(projectId, prompt, agentId?)` to `onAgentStarted` (#1191), with
  the id-less adopt fallback; sweep-backed clicks deliberately do not navigate. A failed direct
  start surfaces via `useStartAgent().error` in the `role=alert` line. Holds — except the
  in-flight guard gap, bug 1.
- **The button says what it costs**: tooltip = job's own `tooltip` sentence + settings line
  (`describeAgentSettings(preferences)`, the same preferences the start reads; the drain
  substitutes "Each project's own settings decide…") + the three-form count line (drain /
  fan-out / one agent), with singular/plural handled. "Starting…" is keyed to
  `starting === job.name`, so only that row's label changes. Holds (but see bug 1: the label can
  revert early).
- **Configure first, then run**: chevron menu, one entry; stashes the prompt via
  `stashPendingDraft` and calls `onSelectProject(projectId)`; not gated on `busy` (starts
  nothing); fan-out rows get the "one agent, not the fan-out" wording. Holds.
- **Picked project is a preference** (#1647): `preferences.autoPmProject`, validated against the
  loaded list with first-project fallback; picker only with >1 project; the select writes the
  preference. On the Overview route `usePreferences()` resolves no repo tier (no project in the
  URL), matching the SPEC's "the repo's committed configuration is not resolved here". Holds.
- **Two tiers of switch / opt-out recorded**: row checkbox ↔ `autoPmOptOut` (whole list written,
  preserving siblings), title-as-label; foot checkbox ↔ `autoPm`, label becomes the countdown
  only when `autoPm && report?.nextSweepAt !== undefined`. Opt-*out* stored, so unknown-to-old-
  configs routines default on. Holds.
- **Fast-forward**: "Trigger routine now" always enabled except while `sweeping`; off-schedule
  tooltip says auto-run stays off; outcome reporting via `describeOutcomes` implements all four
  SPEC forms (single plain, multi folder-prefixed with `path.split('/').pop() || path` guarding a
  trailing slash, "considered no projects", unreadable → "The sweep ran."), and the not-a-sweep
  host message for `ok: false`. The same reporting serves narrowed Run now clicks. Holds.
- **Concurrent agents**: `preferences.autoPmConcurrency ?? DEFAULT_AUTO_PM_CONCURRENCY` (daemon's
  default shown, per SPEC), floored at 1 on write, no max, empty input ignored — but the
  controlled-input mechanics defeat the SPEC's mid-edit state, bug 2. Consequence sentence has
  both forms. Holds otherwise.
- **Nothing-ticked warning**: `autoAgent && every(job => optedOut.includes(job.name))`. Holds.

## Functions (low-level)

### `narrowedSweep(job, projectId)`

Declaration-driven dispatch; returns undefined for plain routines. Correct.

### `describeOutcomes(outcomes)`

Four-way projection, exactly the SPEC's wordings. Correct.

### `RoutineWork(...)`

- `sweepNow`: self-guarded (`if (sweeping) return`) and the button disables while in flight;
  failure → the honest no-sweep-host line. Correct.
- `configureFirst`: no-op without a project; stash-then-navigate. Correct.
- `runNow`: see bug 1 — the narrowed branch has no in-flight guard of its own (`busy` only covers
  direct starts, and `starting` is set but never checked). The direct branch is double-click-safe
  in practice: `setBusy(true)` inside `useAction.run` is scheduled synchronously within the first
  click's handler, so a second discrete click re-renders against `busy === true`.
- Concurrency `onChange`: trims, ignores empty (deliberate — `Number('')` is 0) and non-finite,
  rounds and floors at 1. Correct per the save rules; the controlled-value snap-back is bug 2.
- Row checkbox `setRoutine`: writes the whole opt-out list; cannot duplicate (the un-tick path
  only appends when the box was checked, i.e. the name absent). Correct.

## Bugs found

1. `L184-197` (`runNow`, narrowed branch): no in-flight guard for sweep-backed Run now clicks.
   `busy` only reflects direct starts, and `starting` is never checked, so a second click on (or
   during) a sweep-backed routine fires a second `sendAutoPmSweep` immediately. The daemon's tick
   is re-entrancy-guarded (`if (stopped || sweeping) return` in auto-pm.ts), so the second RPC
   returns at once — and `sendAutoPmSweep` then reads the loop's report, i.e. the *previous*
   sweep's outcomes. The second click therefore (a) flips the row's label from "Starting…" back
   to "Run now" while the first sweep is still running — contradicting the SPEC's "While a
   routine is starting, its own button reads 'Starting…'" — and (b) prints a stale outcome line
   as if the click had completed, the exact "looked like it ran" confusion #1433 exists to
   prevent. Severity: minor. Fix: guard `if (starting) return` (or `if (starting || sweeping)`)
   at the top of `runNow` and disable the row buttons while `starting !== null`, mirroring
   `sweepNow`'s own guard.
2. `L402-420` (concurrency `<input type="number" value={concurrency}>`): the box can never
   actually be cleared. It is fully controlled with no draft state; the empty-string change is
   deliberately not saved, so no re-render happens and React's controlled-input restoration snaps
   the visible value straight back. The SPEC's "A cleared box is treated as mid-edit" state is
   unreachable: a user who clears 3 to type 12 sees the 3 reappear and their next keystrokes
   compose with it ("31", "312" — each intermediate value *saved* as the preference, since every
   valid change writes through). "Saves nothing on clear" holds; "treated as mid-edit" does not.
   Severity: minor. Confidence: medium (React snap-back behavior is certain; how literally the
   SPEC's mid-edit wording binds is the judgement call). Fix: hold the typed text in local state
   (`const [draft, setDraft] = useState<string | null>(null)`), render `draft ?? concurrency`,
   save on valid parse, and drop the draft on blur.
