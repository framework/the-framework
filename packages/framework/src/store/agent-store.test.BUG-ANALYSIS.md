# Bug analysis: packages/framework/src/store/agent-store.test.ts

## Business logic (high-level)

The test suite for the agent record (source analyzed in `agent-store.BUG-ANALYSIS.md`), checked
against `agent-store.test.SPEC.md`. Every clause of that test-SPEC maps to a real test, and each
test was read for whether it can fail and whether it asserts what it claims:

- **Starting/appending** — fresh truncation + initial meta, seeded intent, non-local target
  recorded / local left off, one JSONL line per event with meta kept in step, `updatedAt` advancing
  via an injected stepping clock, daemon-allocated id adopted with unsafe id falling back, id ↔
  start-time round trip refusing foreign ids. All present and assert real outcomes.
- **Folding** — per-leg model (latest wins, absent clears), handoff arming mirrored without
  padding, handoff report done/skipped/failed, skip reason set only on skip and cleared by a later
  publishing handoff, merge outcome folded (including on an `already-open` skip) and absent
  without a merge half, failed vs stopped endings, settled/un-parked/cleared-by-end, session name
  + ready-for-merge non-clobbering, ticket surviving the end, gate open/mismatched-resolve/matching
  resolve/end-clears, PR and branch recorded with rename replacing and both surviving the end.
  These are pure `applyEventToMeta` calls on a `BASE` built by a real store fold (`foldLive`) —
  honest construction, deterministic clock.
- **Reading** — round trip, torn trailing line dropped (live and archived), never-ran workspace
  empty, non-fresh open preserving the log.
- **Archiving/history** — close archives pair, crash rescue at fresh open, worktree archive before
  teardown with running→stopped flip, per-user committed archive (and *not* the transient dir),
  every-user + transient listing under current names only (old `runs/`, `sessions/`, pre-D5
  `run.json` all rejected), both-schemes dedup to one row, archived replay wherever filed, `since`
  cutoff skipping by filename with a read-spy proving the old record is never opened while a
  foreign-named record still is.
- **Liveness/self-healing** — owner pid+host recorded, dead-owner heal (stop + archive), alive
  owner untouched, pre-pid and other-host left for boot reconcile, boot reconcile flipping archived
  stuck-running records / live (counted once) / worktree / committed-under-user, leaving alone a
  provably-alive pid (asserted by reading raw files, correctly avoiding the readers' own real
  pid probe), no-op on clean/empty workspaces, surrogate `end` landing in live log + worktree log +
  archived copy with the gate cleared everywhere, and no second ending for a run that wrote its
  own.
- **Concurrent read/write survival** — the strongest suite: a spy fs proves the live meta path is
  *never* opened for writing (only ever a rename target from its own `.tmp` scratch), no scratch
  file left behind, torn `agent.json` re-read rather than reported absent (with a tearing fs that
  settles the write before the retry), corrupt-for-good gives `undefined`, a rename-less fs still
  writes in place.
- **Finding live agents** — per-worktree discovery newest-first with each row carrying its own
  checkout, root fallback, junk/rename-link names never mistaken for checkouts, dead worktree run
  healing on the list read, never-ran empty.
- **Continuing** — same id/log/running/new owner/pinned intent, kind preserved across a
  `fresh: true, continueAgent: true` reopen, fallback to fresh with nothing to reopen, archived
  history restored into the worktree with live-agent and no-archive no-ops.
- **Patching** — PR and branch patched onto the archive and read back; unknown and unsafe ids
  refused with `false`.

Test-quality observations (none rising to a reportable bug):

- `memFs` is a faithful minimal `StoreFs`: `readdir` derives child names (files *and* deeper
  directories) from the flat map, which is exactly what `archiveDirs`/`worktreeDirEntries` need;
  it deliberately omits `rename` so the default path exercises the in-place fallback, while the
  atomic-write test supplies its own recording `rename`.
- Top-level `const BASE = await foldLive(...)` runs before any test; a failure there fails the
  whole file loudly rather than silently skipping — acceptable.
- The both-schemes dedup test (L744) asserts only that one row is listed, not *which* copy won;
  the SPEC says the committed copy wins. The ordering that guarantees it (`archiveDirs` committed
  first) is untested here — a coverage gap, not a wrong assertion.
- The `#926` reconcile test injects `pid => pid === 42` and then inspects raw files instead of
  going through `readLiveMeta`/`listAgents`, with a comment explaining why (those run the real
  process-table probe) — correct craftsmanship, avoids a test that would rot when pid 42 exists.
- The tearing-fs test (L332) mutates shared state from inside `read` to model
  write-lands-before-retry; `reads > 1` asserts the retry actually happened. Sound.
- `worktreeFiles`/`worktreeAt` helpers build `tf-agent-<id>` dirs, matching the real naming;
  the rename-link test (L796) uses a link *without* the run prefix, so it does not cover the
  `tf-agent-*`-named link collision reported against the source (agent-store.BUG-ANALYSIS.md
  bug #2) — consistent with that being a real, untested hole.

## Functions (low-level)

- `memFs(seed)` — in-memory `StoreFs` + exposed `files` map. `read` throws ENOENT-style on
  missing, `append` creates, `mkdir` no-op, `readdir` prefix-scan returning first path segments.
  Correct for every store code path used; no `rename`, by design.
- `foldLive(events, at)` — folds through a real store (open + append), returning `snapshot()`;
  ensures fold tests exercise the store's own append path, not a private re-implementation.
  Correct.
- `RUN`, `BASE`, `AT`, `CWD`, `EVENTS`, `META` — fixtures; `RUN` ends with `end ok:true` so
  close/archive tests get a finished agent. Correct.
- `runningAgentMeta` / `ownedMeta` / `worktreeMeta` / `deadGatedMeta` — meta literals for each
  liveness shape (no pid / owned / worktree / dead-with-gate). `deadGatedMeta` uses pid 999999 +
  this host, large enough to be dead on any CI box in practice; the heal tests that must be
  deterministic pass an explicit `isAlive` stub instead, so no flakiness rides on that pid.
- `lastEvent(jsonl)` — parses the final line; used only on logs the test just wrote. Correct.
- `worktreeAt` / `worktreeFiles` / `archiveAt` / `USER` / `RUNS` — path helpers mirroring the
  production layout (`branches/tf-agent-<id>`, `branches/tf-data/agents/<user>/`). Correct.
- The individual `test(...)` bodies — each asserts on concrete observable state (file contents,
  parsed meta, returned lists); every awaited call is awaited (`store.append` returns the tail and
  is awaited throughout; no floating promises). No test asserts a tautology; the atomic-write test
  would fail on any regression to in-place writes, the spy-read test on any regression of the
  filename cutoff.

## Bugs found

None found. (Coverage gaps noted above — committed-copy-wins ordering and the `tf-agent-*`-named
rename link — belong to the source-file report, not to a defect in these tests.)
