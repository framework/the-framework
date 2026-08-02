Watches the PRs the framework is waiting to land and acts on what their CI says (#1418): merges a `watched` PR once its checks pass (the #1417/#1406 answer for repos without GitHub auto-merge), and starts one unattended fix session per failing head commit.

## TLDR

- `sweepProjectCi(cwd)`: scans run metas for `mergeOutcome` `watched`/`auto-armed` (ended, within a 7-day window), resolves each run's PR, reads its combined check state, then: green `watched` → merge; red → request a fix session; pending → wait; not-OPEN → done.
- `startCiWatch`: sweeps every registered project on a 1-minute timer (immediate first sweep, unref'd, overlapping ticks join), logging every merge, refusal and fix start.
- `ciFixPrompt`/`ciFixMarker`: the fix session's prompt opens with `[ci-fix] PR #N @<sha>`, which is also the durable record of the attempt — scanned off the same metas.
- All collaborators injectable (`CiSweepDeps`) for disk- and `gh`-free tests.

## Problems

- Merging on the direct fallback lands work before CI has run (#1406): a repo without GitHub auto-merge saw every armed PR merged seconds after opening. The `watched` outcome (events.ts) plus this sweep make merge-on-green work regardless of the repo setting (#1417).
- A local daemon has no public URL, so GitHub webhooks cannot reach it: polling `gh` (~1 min, agreed on #1418) is the trigger; the decisions all start from what `gh` answers, so a hosted webhook receiver can later feed the same handlers.
- Red CI on a framework PR is work produced and then abandoned to a human — the fix half puts an agent on it, told to land the fix on the PR's own branch so the checks rerun and the merge half finishes the job.

## Decisions

- An `auto-armed` PR is never merged here — GitHub holds that promise — but its checks going red still starts a fix (nobody else fixes red).
- CLOSED-unmerged PRs are left alone: that is a human's rejection of the work.
- "No checks" only counts as green after `NO_CHECKS_GRACE_MS` (3 min) of PR age: a suite takes seconds to attach after a push, and merging inside that window is #1406 again. Unknown PR age never merges.
- A concluded failure is `failing` even while other checks run: more green cannot unsay it. Skipped/neutral conclusions pass, matching GitHub's merge box; cancelled/timed-out do not.
- Fix restraint, applied before the wiring's gates: one session per failing head commit (marker scan), at most one in flight per PR, `MAX_CI_FIX_ATTEMPTS` (2) per PR ever. No head sha/branch on the read → stand down rather than guess.
- The `@` in the marker is always present so `PR #12` cannot prefix-match `PR #123`.
- A failed merge is remembered in-memory (`attemptedMerges`, keyed by cwd + PR + head sha) and not retried for that head until a daemon restart: branch protection demanding a review must cost one `gh` write, not one per tick for a week. A push that changes the head re-arms exactly one more attempt (#1484) — a PR that arrived unmergeable (stale-branch bookkeeping conflict) must not stay skipped after its conflict is resolved and checks rerun. Its log line is said once (`sayOnce`), as is the attempts-exhausted line.
- The 7-day window (`CI_WATCH_WINDOW_MS`) bounds the sweep's `gh` spend against a growing archive; older PRs are a human's to land.
- The fix half's gates live in the daemon wiring, not here: `autoPm` preference (consent to spend quota unasked) + quota headroom, per attempt. The merge half is ungated — it finishes a merge the run was already armed and authorized for.
- The fix session runs with push/PR/merge handoff disarmed: its work belongs on the red PR's branch (`git push origin HEAD:<branch>`), never on a PR of its own.

## Facts

- Candidates come from live + archived metas (`readLiveMetas` + `listRuns`); `running` runs are skipped — merging under a working agent is nobody's feature.
- Two runs resolving to the same PR cost one checks read and at most one merge per tick (`seen` set).
- `mergeSessionPr` is the merge primitive, so the watch, the human Merge button and the handoff share one behaviour (and the PR caches are forgotten on success).

## Flows

- sweep one project: metas → `watchable` filter → per candidate: `resolveRunPr` → OPEN? → `ghPrCiStatus` → green/`watched` → `mergeSessionPr`; red → dedupe markers → `deps.fix` (daemon starts unattended session with `ciFixPrompt`); tally merged/failed/fixes
- daemon service: `startCiWatch` → immediate `tick()` + 1-min `setInterval` (unref) → per project `sweepProjectCi` → log lines
- fix session: fetches the PR branch, resets onto it, diagnoses the failing checks, pushes `HEAD:<branch>` → checks rerun → next sweep merges on green
