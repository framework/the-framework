# Bug analysis: packages/framework/src/data-branch.ts

## Business logic (high-level)

The `tf-data` branch (#1582): one branch of the project repo holds everything The Framework writes (tickets, queue, archives). Responsibilities per `data-branch.SPEC.md`:

- **Ensure** (`ensureCore`): branch exists (adopted from origin, else born parentless off the empty tree via `commit-tree` + `branch` — no checkout touched), worktree at `.the-framework/branches/tf-data`, queue file (`TODO_AGENTS.md`) seeded+committed on an empty branch, root `tickets` symlink (relative, created only over nothing, hidden from git with the `/tickets` + `!/tickets/` exclude pair).
- **Write funnel** (`withDataBranch`): serialized per project (promise-chain lock), cycle = ensure → sync → op → `add -A` → commit-if-staged → push-if-owed, two push attempts, never throws; failure resets the checkout so half-written files cannot ride a later commit.
- **Sync** (`syncCore`): fetch + rebase local commits onto origin; a conflicted rebase aborts and hard-resets to origin (remote wins; the running op re-applies its intent).
- **Eager pull** (`pullDataBranch`): the same cycle with a no-op op; reports no-remote as an error (a sync's job is to meet other machines).
- **Read** (`readDataFile`): checkout file → `git show tf-data:rel` → `origin/tf-data:rel` (fresh mode fetches and prefers origin). `dataProjectRoot`: dirname of `--git-common-dir`.

### Confirmed bug — duplicate application of a non-idempotent op after a failed push (LIVE REPRO)

`withDataBranch`'s retry loop (L237-258) re-runs `op` after a failed push, but the failed attempt's commit *survives* the re-sync: `syncCore`'s clean rebase replays it onto origin (and when the fetch itself failed, the commit is simply still there). The op then runs a second time against a checkout that already contains its own first application. The module doc demands ops be "re-runnable ... against the fresher state rather than force-fitting a stale commit" — but the stale commit is *kept* (except in the conflict path, where `reset --hard origin` drops it), so "re-runnable" silently must mean "idempotent". The real ops are not all idempotent: `todo-loop.ts` `appendTodoEntry`/`appendFlatTodoEntry` blindly append a line to the queue.

Reproduced against the built module with a real repo + bare origin and a git runner that fails the first `push` only (simulated network blip):

```
result: {"ok":true,"changed":true,"pushed":true}
queue on branch: "- [ ] resume the thing\n- [ ] resume the thing\n"
```

One transient push failure → the queue entry lands twice → a later drain runs the work twice — and the cycle reports clean success. The SPEC's own race story ("Another machine pushes ... in the instant between this machine's sync and its push") triggers the same double-apply whenever the rebase is clean (disjoint files). Contradicts "A write is an intent, not a commit" (the intent is applied twice) and the test suite's premise that appends are safe ops (`data-branch.test.ts` uses appending ops throughout).

Fix sketch: on a failed push, first re-sync and try pushing the *surviving* commit again without re-running `op`; run `op` again only when the sync's conflict path dropped the local commit (e.g. compare `rev-parse tf-data` before/after `syncCore`, or check `rev-list origin/tf-data..tf-data` emptiness to decide whether the intent still exists locally).

### Other analyzed failure modes

- **Outer catch mislabels `committed`** (L259-264): the catch reports `{ok:false, committed:false}` ("nothing survived"), but it can be reached *after* an earlier attempt committed — e.g. attempt 0 commits, push fails, attempt 1's `op` or a git call throws. The `reset --hard` puts the checkout at HEAD (= the surviving commit), which will push on a later cycle. Callers branch on `committed` (`ticket-locks` treats `!ok && !committed` as "claim did not land" → 'error'; `routine-locks` `result.ok || result.committed` as "lock landed"), so a claim that did land locally is reported as lost — a later push then materializes a lock/queue state the caller believes absent (phantom claim). Narrow double-fault window; minor.
- **Stranded conflicting commit dropped by the eager pull**: a commit an earlier failed cycle left local ("a push is owed until it lands") is discarded by `syncCore`'s conflict path (`reset --hard origin`) during a cycle whose op knows nothing of it — most plainly `pullDataBranch`, whose op is empty. The SPEC's justification ("Nothing is lost ... the local intent is re-applied immediately afterwards by the cycle that is running") only holds for the running cycle's own intent, not for the stranded one. Silent data loss in the offline-write-then-conflicting-remote-write case; the design leans remote-wins, but "a push is owed until it lands" is broken specifically when the owed commit conflicts. Minor/low — arguably an accepted tradeoff, recorded for the orchestrator to judge.
- **Interrupted rebase wedges the funnel**: kill the daemon mid-`git rebase` (syncCore) and the data worktree is left detached with rebase state. On the next cycle `ensureCore` runs *first*: `rev-parse --abbrev-ref HEAD` → `HEAD` → not on branch → branch exists → `worktree add <path> tf-data` fails ("already exists") → every subsequent cycle errors identically. The recovery that exists (`rebase --abort` in syncCore's catch) is unreachable because ensureCore throws before syncCore runs. Self-inflicted permanent error state requiring manual repair; the SPEC's "reports why and is left alone" softens this, but the state is framework-created, not user-created. Minor/low.
- **Dangling `tickets` symlink**: on a branch born empty the checkout has no `tickets/` dir yet, so the root symlink dangles until something commits one. `lexists` (lstat) prevents recreation loops; readers (`dashboard/tickets.ts`) treat it as absent. Cosmetic, consistent with the tests.
- **Re-entrancy**: an `op` that itself calls any public entry point for the same cwd deadlocks on the serialize chain. No current op does; invariant noted.
- **`readDataFile` is unserialized** — it may read the checkout mid-op (torn read). Readers are periodic and self-correcting; noted.
- **Single-branch/shallow clones**: `fetch origin tf-data` only updates `refs/remotes/origin/tf-data` under the standard fetch refspec; a `--single-branch` clone would birth a second parentless history and then fail its push (non-FF), surfacing as a reported error. Environmental reliance, noted.
- **`serialize` map never shrinks** — one settled promise per project retained; bounded by project count.

## Functions (low-level)

- **`dataWorktreePath(cwd)`** — path join; correct.
- **`resolveDeps(deps)`** — lazy `node:fs/promises`; write mkdirs parents; `lexists` true for dangling links (needed for the symlink guard). Correct.
- **`hasRemote(cwd, git)` / `refExists(cwd, ref, git)`** — boolean probes, failures → false. Correct.
- **`serialize(cwd, task)`** — chains on settle (`then(task, task)`), stores a swallowed tail so one failure never poisons the chain, returns the un-swallowed `next` so callers see their own outcome. Correct (verified by the concurrency test's strict interleaving assertion).
- **`ensureCore(cwd, r)`** — common case one `rev-parse`. Branch adoption vs parentless birth; prune before `worktree add` (heals a hand-deleted dir); seed commit with `add -A` (could sweep unrelated crash leftovers into the seed commit — only reachable once, on first setup after a crash; negligible); symlink + exclude pair, both `.catch(() => {})` so a read-only repo does not fail ensure. Wedge case above. Verdict: bug found (wedge, minor).
- **`syncCore(cwd, r)`** — fetch (caught), rebase, conflict → abort + hard reset. `reset --hard` after a failed abort can itself throw → outer catch (reported). Verdict: correct in-cycle; participates in the stranded-drop and double-apply findings.
- **`ensureDataWorktree(cwd, deps)`** — serialized ensure with error envelope; never throws. Correct.
- **`withDataBranch(cwd, message, op, deps)`** — the funnel. Message resolved after the op (batch writers know what they did); `changed` = staged this attempt; owed-push logic (`ahead` true when origin ref missing) carries stranded commits out. Verdict: **bug found** (double-apply, major; `committed:false` mislabel, minor).
- **`pullDataBranch(cwd, deps)`** — no-op write + explicit no-remote error; logs via seam. Correct in itself; inherits the stranded-drop semantics.
- **`dataProjectRoot(cwd, git)`** — dirname of absolute `--git-common-dir`; correct for main checkouts and linked worktrees (submodule layouts would mis-resolve; none exist in this system).
- **`readDataFile(cwd, rel, opts, deps)`** — source order as documented; empty-file reads return `''` (not confused with absent); `git show` failures → next source → undefined. Correct.

## Bugs found

1. **L237-258 (`withDataBranch` retry loop): a failed push re-runs the op on top of its own surviving commit — non-idempotent ops apply twice.** Scenario (live-reproduced with the built module): `appendTodoEntry` cycle, push fails once (network blip or lost race with a clean rebase); retry re-syncs (commit survives), op appends again, second commit pushes → the queue holds the entry twice and the result claims `{ok:true}`. Contradicts the funnel's "the op is the intent, the commit is just its serialization" contract and duplicates agent work downstream. Severity: **major**. Fix: after a failed push, rebase-and-repush the surviving commit without re-running `op`; re-run `op` only when the sync's conflict path (`reset --hard origin`) dropped the local commit.
2. **L259-264: the outer catch reports `committed: false` even when an earlier attempt's commit landed.** Scenario: attempt 0 commits, push fails, attempt 1 throws (op or git error) → caller (ticket-locks/routine-locks/daemon-services) is told nothing survived, yet the commit pushes on the next cycle — e.g. a ticket lock reported as not-taken that later materializes. Severity: minor. Fix: track whether any commit landed during the cycle and report `committed: true` in the catch when one did (HEAD moved since entry).
3. **`syncCore` conflict path (L178-183) discards a stranded owed commit during cycles that cannot re-apply it (esp. `pullDataBranch`).** Scenario: machine offline → write commits locally, push fails; other machine pushes a conflicting queue edit; this machine's next *pull* rebase conflicts → hard reset to origin → the stranded change is gone silently and the pull reports ok. Contradicts "A push is owed until it lands"/"Nothing is lost". Severity: minor (remote-wins is partly by design). Fix sketch: before dropping, re-queue the stranded commit's patch (e.g. `git diff origin..tf-data` saved aside) or at least report the drop so the daemon can surface it.
4. **`ensureCore` (L120-142) permanently wedges after a daemon kill mid-rebase.** Scenario: SIGKILL during `syncCore`'s rebase leaves the data worktree detached with rebase state; every later cycle fails at `worktree add ... already exists` (ensureCore runs before syncCore's abort-recovery can). All data writes for the project fail until a human intervenes. Severity: minor (small window, loud error). Fix: when the worktree dir exists but is not on `tf-data`, run `git rebase --abort` / `git checkout tf-data` in it (or remove and re-add the worktree) instead of unconditionally `worktree add`.
