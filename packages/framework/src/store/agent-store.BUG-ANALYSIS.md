# Bug analysis: packages/framework/src/store/agent-store.ts

## Business logic (high-level)

The module is the durable record of every agent: an append-only JSONL event log
(`events.jsonl`), the `agent.json` meta folded from that log, the archive a finished agent leaves
behind (`agents/<id>.jsonl` + `.json`, transient under `.the-framework/agents/` and lasting under
`.the-framework/branches/tf-data/agents/<user>/`), plus the reads that compose all of that into
"a project's agents". Sibling `agent-store.SPEC.md` defines the intended behavior in detail; the
implementation was checked clause by clause against it.

Key invariants and how the code holds them:

- **Meta = fold of the log.** `applyEventToMeta` is pure and shared by the live append and the
  replay/heal paths. Per-rule checks: gate opens on `choice`, closes only on the matching
  `choice-resolved` id or `end` (correct, L351–356/394–401); `driver` `start` clears `settledAt`
  (L390–392); per-leg model — a `session` event without `model` deletes it rather than inheriting
  (L336–339, spec-blessed); `handoff` clears a stale `handoffSkip` on any non-skipped outcome
  (L367–373); `end` clears `pendingChoice`/`settledAt`/`browserStreamPort` (L394–401). All match
  the SPEC's "folding rules that are not merely last-value-wins".
- **Id = start time.** `agentIdFromStartedAt` replaces `[:.]` in a fixed-width ISO string, so lexical
  order is chronological; `startedAtFromAgentId` inverts it with a strict regex and returns
  `undefined` for foreign ids. `isSafeAgentId` (`^[A-Za-z0-9_-]+$`) is checked at every path-building
  entry point (`addWorktree` in worktree.ts relies on it too). `namedBefore` uses the inversion to
  reject old archive entries by filename only, and deliberately cannot reject a foreign name
  (test-pinned).
- **Torn writes.** `writeMetaFile` goes scratch (`<path>.<pid>.tmp`) + `rename`; `readMetaFile`
  retries a parse failure twice with a 5 ms pause. `parseEventLog` stops at the first unparseable
  line (torn tail) and keeps everything before it, shared by live, archived and exported readers
  (`readEventLog`). The rename-based invariant is test-pinned ("agent.json is never opened for
  writing at its own path"). One writer bypasses it — see Bugs #1.
- **Crash rescue and orphan healing.** `archivePriorAgent` runs at every fresh open;
  `recordOrphanEnd` appends the surrogate `end` before the meta flip so both the live tail and the
  archived replay see the agent finish and the parked gate expire (#1359); `ownerLiveness` is the
  three-state probe (live/dead/unknown), with boot reconcile flipping `unknown` and the
  read-time self-heal leaving it alone — both directions match the SPEC's stated split. Note a
  latent cross-machine tension the SPEC itself blesses: the boot reconcile also flips `running`
  records archived by *another host* onto the shared data branch (test "a pid on another host is
  unknowable, so it is still flipped"). Committed archives are only written at teardown, after the
  status flip, so a genuinely-running other-host record should not normally exist there; flagged
  as accepted-by-spec, not a bug.
- **Composition.** `readAllAgents` = live (`readLiveMetas`) + archived (`listAgents`) with live
  winning by id; `findAgent` is the single-row variant. `archiveDirs` searches committed user dirs
  first, then the transient dir, and `readAllArchivedMetaEntries` dedups first-wins, so the
  committed copy wins — as specced.
- **Best-effort everywhere.** Every heal/archive/patch path catches and returns rather than
  throwing into a read. The one deliberate side effect is that a failed persisted write leaves the
  in-memory snapshot ahead of disk, which the module accepts by design.

Concurrency notes examined:

- `AgentStore.append` serializes writes through `this.tail`; the catch handler resolves the chain so
  a failed write does not wedge later ones. `close()` awaits the tail first. Correct.
- Two *processes* (agent + daemon teardown) writing the same meta use pid-distinct scratch names —
  the documented reason for the name. Two concurrent writers in the *same* process (two RPC reads
  both self-healing the same dead agent) share one scratch name; the loser's `rename` throws
  ENOENT and is swallowed. State converges, but each healer also appends its own surrogate `end`
  line — see Bugs #3.
- `reconcileOrphanedAgents` orders archived-flips before the live flip so the fresh archive is not
  re-counted; however an agent already present in both places before the call is counted twice in
  the returned `fixed` count (archived flip + live flip). The count is informational; cosmetic,
  not reported.

## Functions (low-level)

- `agentIdFromStartedAt` / `startedAtFromAgentId` — inverse pair; regex requires exactly
  `YYYY-MM-DDTHH-MM-SS-mmmZ`, which `Date.prototype.toISOString` always yields. Probed the round
  trip; correct.
- `isSafeAgentId` — refuses separators/traversal; used before every path build (`findArchive`,
  `archivePaths` callers, `restoreArchivedAgent`, `patchArchivedAgent`, `loadAgentEvents`,
  `worktreeDirEntries`). Correct.
- `applyEventToMeta` — pure fold; returns a shallow copy, never mutates nested objects of the
  input. `handoff` with outcome `failed` cannot carry `merge` (the event union has no such field on
  that variant), so the `event.outcome !== 'failed'` guard is TS narrowing, not a behavior hole.
  A skipped handoff without a `merge` half retains a prior leg's `mergeOutcome` — right, the PR
  from leg one still exists. Correct.
- `freshMeta` — drops `target: 'local'` (readers assume it), adopts a daemon-allocated id only when
  path-safe. Correct.
- `parseEventLog` — `break` (not `continue`) on the first malformed line: intentional per the
  torn-tail doc, and pinned by tests. A malformed *middle* line (hand-edited log) silently drops
  the tail; accepted by design ("stops the read").
- `readMetaFile` / `writeMetaFile` — retry-backstop + atomic-swap pair; `writeMetaFile` falls back
  to in-place for adapters without `rename` (the in-memory test fs). Correct. Its contract comment
  says *every* meta write in the module goes through it — violated by `patchArchivedAgent`
  (Bugs #1).
- `orphanEndEvent` / `recordOrphanEnd` / `stopAndArchiveLive` — append end, fold, write meta,
  archive; every step `.catch`ed. `recordOrphanEnd` folds with real `new Date()` (not the injected
  clock) — fine, this path runs outside any store instance. Correct.
- `AgentStore.open` — continue path reopens prior meta (same id, original intent pinned, new
  owner), returning before `fresh` truncation, so `fresh: true` + `continueAgent: true` (the CLI's
  actual call shape, cli.ts L813) preserves the log when there is something to reopen and starts
  clean otherwise. `opts.kind`/`opts.target`/`opts.id` are deliberately ignored on reopen (kind
  preservation is the point of #1467; target cannot change on a resume in practice). A non-fresh,
  non-continue open persists nothing — documented "read-only-ish"; no production caller uses it.
  Correct.
- `AgentStore.append` — folds synchronously, queues the disk append + meta write; returns the tail
  so tests can await. `pinnedIntent` re-applied after every fold (only relabels when a prior intent
  existed — a continuation of an intent-less agent takes the resume message as its label, which is
  the only label it will ever have; acceptable). Correct.
- `close` — flush + archive to the *transient* dir (worktree-internal for worktree agents); the
  lasting copy is teardown's `archiveWorktreeAgent(user)` job. Correct per SPEC.
- `snapshot` / `loadEvents` / `readMeta` — trivial; correct.
- `archiveDir` / `committedArchiveDir` / `archivePaths` — path builders; correct.
- `findArchive` — committed dirs first, so the committed copy is the one patched/read; consistent
  with the dedup order. Correct.
- `archiveDirs` — pushes a committed child only when its own `readdir` is non-empty; a stray file
  yields `[]` on the real fs (readdir catches) so it is skipped, as documented. The transient dir is
  always appended (a missing dir readdirs to `[]` downstream). Correct.
- `archiveAgent` — mkdir + write log + `writeMetaFile`; idempotent per id (overwrite-same).
  Correct.
- `archivePriorAgent` — checks only the *transient* archive for prior existence; for root agents
  (the only ones whose live files sit where this runs at fresh open) the transient dir is exactly
  where `close()` archives, so the check is sufficient. Correct.
- `restoreArchivedAgent` — refuses when a live meta already exists in the worktree; writes the
  restored `agent.json` via plain `fs.write` (not `writeMetaFile`). A `readLiveMetas` poll landing
  mid-write reads a torn meta, retries, then treats it as absent for that poll — no row existed for
  it before, and the archived copy still lists the agent, so no user-visible flicker; noted, not
  reported.
- `worktreeDirEntries` / `listWorktreeDirs` — `isWorktreeDirName` (the `tf-agent-` prefix) plus
  `isSafeAgentId` filter; rename links (`tf-<session>`) are excluded *only because* session slugs
  normally do not start with `agent-`. A slug that does start with `agent-` produces a link whose
  name matches the checkout spelling — phantom entries; see Bugs #2. `StoreFs.readdir` returns
  names only, so the function cannot tell a symlink from a directory.
- `archiveWorktreeAgent` — reads the worktree's live meta, records the orphan end when still
  `running` (#1359), stamps the caller-observed branch, archives to the user's committed dir or
  the transient one. Never throws. Correct.
- `archivedAgentPaths` — id-safety + findArchive; returns `[meta, events]` even when the events
  file is absent (callers delete tolerantly). Correct.
- `byIdDesc` / `namedBefore` / `readArchivedMetaEntries` / `readAllArchivedMetaEntries` /
  `listAgents` — filename-dated cutoff (`Date.parse(startedAt) < since`, strict, so a record at
  exactly `since` is kept), foreign names always read, torn entries skipped without the
  `readMetaFile` retry (the only in-place writer of these files is `patchArchivedAgent` — Bugs #1
  is what makes that skip observable). Correct otherwise.
- `isDeadRunningAgent` / `ownerLiveness` — narrowing helper + three-state probe; `hostname()`
  compared per call. Correct.
- `reconcileOrphanedAgents` — three sweeps (archived, live root, worktrees), each best-effort; the
  worktree sweep heals in place then copies into the repo, leaving the worktree on disk (specced:
  kept for inspection). Correct; `fixed` can double-count one agent present in two stores
  (cosmetic).
- `isPidAlive` — `kill(pid, 0)`, `EPERM` = alive; recycled-pid miss documented as accepted.
  Correct.
- `readLiveMeta` — self-heal only on provably `dead`; `unknown` untouched (other host / no pid).
  Correct. Concurrent invocations can double-heal — Bugs #3.
- `readLiveMetas` — root + worktree candidates, per-candidate catch, newest-first. Returns
  the healed (now `stopped`) agent as a "live" row, which `readAllAgents`' live-wins dedup then
  prefers over the archive — same record either way. Correct. Subject to the phantom-link
  duplication of Bugs #2.
- `loadAgentEvents` / `readEventLog` — id-guarded archive replay and exported live-log read; both
  reuse `parseEventLog`. Correct.
- `nodeStoreFs` — narrows `nodeFs()` to the `StoreFs` contract (keeps `rename`, so production gets
  atomic meta writes). Correct.
- `readAllAgents` / `findAgent` — the specced composition; correct.
- `patchArchivedAgent` — id-guarded read-modify-write of the archived meta. Bugs #1: the write is
  a plain in-place `fs.write`, and it also drops the `null, 2` indentation and trailing newline
  every other meta write uses, so a patch reformats a file that lives on the committed data
  branch (gratuitous diff churn on top of the torn-read window).

## Bugs found

1. **L1202 — `patchArchivedAgent` writes the archived meta in place, bypassing the atomic
   scratch+rename every other meta write uses.** Scenario: an agent finishes; the daemon's
   adoption pass (cloud-work.ts) or the dashboard's Open-PR RPC calls
   `patchArchivedAgentOnDataBranch` → `patchArchivedAgent`, which does
   `fs.write(archive.meta, JSON.stringify({...meta, ...patch}))` — a truncate-then-refill of a file
   that `listAgents`/`readAllArchivedMetaEntries` polls constantly and parses with *no* retry
   (torn entries are skipped). A reader landing in the truncate window drops that agent from the
   history/agent list for that poll — the exact "agent blinks out of existence" failure #1540 was
   fixed for; the fix's own doc comment ("every meta write in this module goes through it",
   L494–495) and the SPEC section "The agent meta survives being read mid-write" both state the
   invariant this call breaks. Secondary: the rewrite drops the pretty-print + trailing newline, so
   a patched record on the committed data branch churns its whole-file format. Severity: minor.
   Fix: `await writeMetaFile(fs, archive.meta, { ...meta, ...patch })` instead of `fs.write`.

2. **L795–803 (`worktreeDirEntries`) — a rename link can be named exactly like a checkout dir and
   becomes a phantom agent (defect lives in branch-links.ts; fix there).** Scenario: an agent names
   its session with a slug starting with `agent-` (e.g. `set-session-name` → `agent-view-fix`;
   `parseSessionName` allows any `[a-z0-9-]` slug). cli.ts renames the branch to
   `tf-agent-view-fix`, and `reconcileBranchLinks` (branch-links.ts L86–106) then creates a symlink
   named `tf-agent-view-fix` beside the checkouts (branch ≠ dir name, so a link is wanted).
   `isWorktreeDirName('tf-agent-view-fix')` is true, so `worktreeDirEntries` lists the link as a
   checkout with agent id `view-fix`: `readLiveMetas` reads the same `agent.json` through both the
   real dir and the link and returns the same running agent twice (two rows, duplicate ids, two
   `cwd`s); `listWorktreeDirs` reports a phantom id, giving the retained-worktrees list a bogus
   row and the sweep a second pass over the same checkout (`isWorktreeRoot` on the link resolves
   true via `realpath`). Removal safety still holds (same branch, same recoverability predicate),
   so the damage is duplicated rows and double plumbing, not data loss. Severity: minor.
   Fix (branch-links.ts `reconcileBranchLinks`): never create a wanted link whose name satisfies
   `isWorktreeDirName(name)` — the name is ambiguous with a checkout; alternatively have cli.ts's
   rename step refuse a `tf-agent-*` target.

3. **L1058–1069 (`readLiveMeta` heal path) — concurrent self-heals append duplicate surrogate
   `end` events.** Scenario: two dashboard RPC reads (or a read and the daemon's own poll) run
   `readLiveMeta`/`readLiveMetas` at the same moment over an agent whose owner pid just died; both
   observe `status === 'running'` + dead owner before either finishes healing, so both
   `recordOrphanEnd` calls append an `end` line to the same `events.jsonl` (and both race the meta
   write with the same-pid scratch name — the loser's rename ENOENT is swallowed). The healed log
   then carries two `end` events; replay tolerates it, but the transcript renders a doubled ending
   and the archived copy inherits it permanently. Contradicts the one-`end`-per-agent shape every
   reader keys off (SPEC: "an ending is appended … and that ending is then folded in like any
   other"). Severity: minor. Fix sketch: re-read the meta after the dead-owner check just before
   healing (heal only if still `running`), or serialize heals per path through a module-level
   in-process lock like daemon-runtime's `withAgentLock`.
