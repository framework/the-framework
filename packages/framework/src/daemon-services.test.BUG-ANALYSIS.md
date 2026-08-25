# Bug analysis: packages/framework/src/daemon-services.test.ts

## Business logic (high-level)

End-to-end tests of the daemon-services wiring with real collaborators: a real registry file read by `readPreferences` (via `XDG_CONFIG_HOME`), a real git checkout whose queue and tickets live on the data branch (#1582), the production `QuotaPoller`/`pollerQuotaSource` (only the driver read stubbed, deliberately — a hand-made quota fake "would answer whatever the test wanted", which is how the model gate went unnoticed), and only `startAgent` stubbed to record starts.

What is pinned:

- **Concurrency end-to-end (#1204)**: `autoPmConcurrency: 4` on disk → exactly 4 starts from the *start-up* sweep (no wake call — the machine-booted-with-it-on path), one pinned queue entry each in order, `unattended: true`, `handoff: 'merge'` (drain lands its own PRs), no `planAgent`, tickets riding along one lane each, the report saying "started 4 agents", and the committed drain claim (`CLAIMED: drain-…`) on the data branch that the first prompt names verbatim.
- **Run-now with auto-run off (#1210)**: the start-up sweep stands down (asserted via a bounded 300ms negative window), then `wakeAutoPm({onDemand, only:'drain'})` fans out to the setting (3).
- **Check-off (#1582)**: after the drained run's archived meta reports `status: 'done', handoffReport: 'done'`, the next wake lands a `check off a drained entry` commit on `tf-data` (polled on the *branch log*, not the checkout file — the funnel commits a beat after writing), the entry gets `- [x]`, untouched entries stay bare.
- **Failed handoff (#1582)**: `handoffReport: 'failed'` → after a settle window nothing is checked off and the entry stays open (negative assertion with a 1.5s window; the positive sibling lands "well inside" it, an explicitly reasoned trade).
- **Missing tickets/ recreated**: dropping `tickets/` from the data branch (git keeps no empty dirs) still claims and starts, with the lock landing in a recreated `tickets/`.
- **Data-sync error lifecycle (#1599)**: real git, no remote → `data-sync` error with `/no remote/` plus a daemon log line; adding a bare remote → next sync clears the error entirely.
- **Model-scoped quota (#1619)**: account week 30% used but the preferred model's week 100% → zero starts, and the report names the window (`Current week (Fable) is 100% used`); the same spent Fable week does not stop a batch on Opus, which goes out on the model the gate measured.

Do the tests verify their claims? Yes — they assert recorded starts (count, options, order, prompts), on-disk/data-branch artifacts, and the sweep's own report (the stand-down test waits on `outcomes.length > 0` rather than a bare delay, so "ran and decided not to start" is distinguishable from "has not run"). Cleanup awaits `quiesce()` *before* removing directories — explicitly so the in-flight sweep is not deleted out from under (this also depends on the clock's stop waiting out the turn, which daemon-tick pins).

Robustness notes (not bugs): `activeAgentSlots: () => starts.map(...)` reports every recorded start as live forever — fine for these single-batch tests since the cap is measured before starts land; the negative windows (300ms / 1.5s) are timing-based but conservative in the direction that matters (a false pass would require the start-up sweep to take >300ms *and* the behavior to be wrong in the same run — and the concurrency sibling covers the positive half); the start-up tick also runs CI watch/cloud sweeps against the fixture repo, all of which degrade gracefully without `gh`/a remote. Fixtures use `tmpdir()` per repo convention.

## Functions (low-level)

- `QUEUE_ENTRIES` — six parseable entries with distinct ticket links; the seeding regex extracts each ticket path and writes the file, so `readTickets`/`findTodoBacklog` see a coherent data branch. Correct.
- `accountQuota(windows)` — production poller polled once over a stubbed read; returns the production source. Correct.
- `weekResetText()` — a reset 4 days out formatted as the driver prints it (`Aug 29 at 7am (UTC)`); ~43% of the week elapsed puts the boundary far above 1% used and below 100%. Month/day from UTC getters, consistent with the UTC label. Correct.
- `services(preferences, quota?)` — builds config + git project, seeds the data branch (asserted `seeded.ok`), writes the registry JSON with the project and preferences, starts the real services with recording seams, and returns `stop` that quiesces before removing. Correct.
- `settle(check, ms)` — 10ms bounded poll; also used as a plain delay via `() => false`. Correct.
- `archiveMeta(projectDir, meta)` — writes the archived agent record where the promote poll reads it (`.the-framework/agents/<id>.json`) with plausible timestamps. Correct.
- The seven tests — each traced above; assertions match the production behaviors and messages (e.g. the report string `started 4 agents`, the lock prefix `CLAIMED: drain-`, the commit subject `check off a drained entry`, the quota message naming the model window). Correct.

## Bugs found

None found.
