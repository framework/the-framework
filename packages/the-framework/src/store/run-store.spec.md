Persisted orchestration state (#211): an append-only JSONL log of `FrameworkEvent`s per run plus a derived `run.json` meta snapshot, with archiving, liveness self-healing, and every read path the dashboard/daemon uses.

## TLDR

- Layout under `<cwd>/.the-framework/`: `events.jsonl` (live log), `run.json` (meta snapshot), `worktrees/<runId>/` (per-run checkouts, #736), archives in `runs/` (legacy transient) and `<user>/sessions/` (#1179, committed so history survives `git clean -fdx`); a seeded `.gitignore` keeps run state untracked.
- `RunStore.open` (fresh: rescue-archive the prior run then truncate; `continueRun` #762: reopen the existing log, keep the original intent, take ownership) → `append` (fold event into meta, chain write through one tail promise) → `close` (flush + archive as `<id>.jsonl`/`<id>.json`, #303).
- `applyEventToMeta` is the pure fold driving both live appends and replay (`metaFromEvents`); `RunMeta` accumulates status, intent/scope, driver, sessionId/Link/Name, branch (#1277/#799), ticket (#1117), queueEntry (#1253), readyForMerge, handoff arming (#1102), pendingChoice (#636), settledAt (#785), browserStreamPort (#813), target local/actions/remote/web (#610/#1050), topic/boundProjectId (#1120/#1121), owner pid+host (#716).
- Readers: `readLiveMeta` (self-heals a dead-owner run on read), `readLiveMetas` (repo root + every worktree, #738), `listRuns` (all archives, deduped, newest first), `readAllRuns`/`findRun` (live wins over archived, #768), `loadRunEvents`, `readEventLog`, `listWorktreeDirs`, `archiveWorktreeRun` (#737), `restoreArchivedRun` (#762), `archivedRunPaths`, `reconcileOrphanedRuns`, `isPidAlive`.
- Ids: `runIdFromStartedAt` (ISO with `:`/`.` → `-`, fixed-width so lexical order IS chronological order — history sorts by id alone), inverse `startedAtFromRunId` (#1251), `isSafeRunId` gate (`[A-Za-z0-9_-]+`) on every path built from an id.

## Problems

- Orphan detection (#716): a `running` meta whose owning process died (crash, kill -9, sleep) shows as active while nothing reads its `control.jsonl`, so Stop is a no-op. Meta records owner `pid`+`host`; `isPidAlive` probes via `kill(pid, 0)` (EPERM = alive under another user; recycled pids are an accepted rare miss); `host` guards against probing another machine's pid.
- The liveness third state is load-bearing (#716/#926): `ownerLiveness` returns `unknown` for no-pid or other-host metas. Boot reconcile flips unknown to `stopped` (a fresh daemon drives no in-flight run); the read-time self-heal leaves unknown alone (a routine read must not kill a run another machine may own). Reconcile once flipped every `running` meta, and a second daemon marked genuinely live runs finished (#926).
- Torn writes: a crash mid-append leaves a malformed trailing JSONL line — `parseEventLog` stops at the cut instead of throwing; half-written archived metas are skipped.
- Write ordering: appends and their meta rewrite are serialized through one tail promise so they never interleave; persistence is best-effort (a failed write is logged, never breaks a live run).
- A run's history lives inside its own worktree (#736), so deleting the worktree would delete the history: `archiveWorktreeRun` copies it into the main repo first (flipping a still-`running` meta to `stopped` and stamping the branch at the last moment it is observable, #799); reconcile does the same for worktree runs a dead daemon left, keeping the worktree itself for inspection.
- Continue-a-run breaks "archived = finished" (#762/#768): a continued run has an archived copy AND is live again, so dedup lets live win — the old rule showed a running run as finished.

## Decisions

- The dashboard is a pure projection of the event stream, so persisting *is* logging that stream; the agent's own chat transcript is deliberately NOT persisted (Claude Code owns it).
- `WORKTREES_DIR`/`SESSIONS_DIR` constants live here rather than in `worktree.ts`/`sessions.ts` because those modules import this one — the other direction would be an import cycle.
- Archives are searched newest-scheme-first (each `<user>/sessions/`, then legacy `runs/`), deduped by id with the committed copy winning; every user's sessions are listed — the history is a team-visible record, which is the point of committing it.
- `settledAt` (#785) is deliberately not a `RunStatus`: the run IS live while parked on the user (process alive, takes messages), and a dozen readers key "live" off `status === 'running'`; a `driver start` event clears it, `end` clears pendingChoice/settledAt/browserStreamPort (a kept port would point at whatever the OS hands that number next).
- Meta `clock` is separate from open-time `now`: reusing `now` froze `updatedAt` at `startedAt`, silently breaking every recency sort (overview, activity feed, interventions).
- The daemon allocates the run id before spawning (it names the worktree with it), passed via `opts.id`, so directory and run are one string rather than two timestamps taken moments apart.

## Flows

- fresh run: `open(fresh)` → archivePriorRun (crash rescue) → truncate log → writeMeta → `append(event)`* (fold + chained JSONL append + meta rewrite) → `close()` → archiveRun.
- continue run (#762): `open(continueRun)` → read prior meta → flip to `running` under this pid/host → same append/close cycle into the same log.
- boot reconcile: `reconcileOrphanedRuns` → flip dead-`running` archived metas → stop+archive dead live run → flip+archive dead worktree runs → count.
- dashboard list: `readAllRuns` = readLiveMetas (root + worktrees, self-healing) ⊕ listRuns (archives), live wins.
