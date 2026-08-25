# Bug analysis: packages/framework/src/routine-locks.ts

## Business logic (high-level)

The "one triage at a time" guard (#1659). A routine of Auto PM's (`triage-quick`, `triage-consensual`, …)
is held for one machine by a file `routines/<name>.lock.md` on the shared data branch, written, read
and removed through `withDataBranch` — the same write funnel every other data write uses — so the claim
reaches every machine sharing `tf-data` rather than living in one daemon's memory. The claim is decided
*before* an agent is started, which is the whole point: the guard it replaced was a rule inside the
routine's prompt, so every false abort cost a spawned agent.

Invariants and lifecycle:

- **Lock content is two lines** (`CLAIMED: <host>` / `SINCE: <iso>`); content missing either line names
  no holder and is not a lock (`routineLockHolder` → `undefined`). Round-trips with `routineLockContent`.
- **Alive lock ⇒ stand down, naming the holder.** Both another machine's lock and this machine's own
  lock from a still-going run stand the caller down; only *this call's own* claim (same host **and** the
  exact `since` this call minted) is treated as ours, which is what makes the op re-runnable.
- **Expiry is fixed at 4 h with no heartbeat** (`ROUTINE_LOCK_TTL_MS`), boundary inclusive
  (`now - since >= TTL`). An unparseable `SINCE` counts as expired.
- **Only the naming machine may drop a lock** — both in `releaseRoutineLock` and in the boot sweep.
- **Nothing throws**: every entry point runs on a background tick with nothing to catch it, so the
  funnel's `DataWriteResult` (never a rejection) is the only error channel, and each function folds it
  into a plain value.

Concurrency / ordering. The interesting hazard is the funnel's re-run: `withDataBranch` serializes per
`cwd`, and on a lost push race it re-syncs and runs `op` again. `syncCore` (data-branch.ts L173-184)
rebases onto `origin/tf-data` and, on conflict, **aborts and hard-resets to origin** — so a lock another
machine landed first always wins and our discarded commit is re-derived by re-running `op` against the
fresher state. Both re-run outcomes are handled: our own rebased lock is recognised as ours (the
host+`since` equality check) and re-committing is skipped; a foreign lock sets `held` and stands us down.
`held` and `released` are both *reset at the top of the op*, so a stale value from attempt 0 cannot leak
into the result of attempt 1 — this is the subtle correctness point of both closures and it is done right.

Failure modes the code deliberately distinguishes: committed-but-unpushed (counts as taken/released, the
gap is logged for acquire) versus not committed at all (took/released nothing, the reason is reported so
the caller retries). The funnel's own catch does `reset --hard` + `clean -fd`, so a half-applied op never
leaves the checkout dirty for a later unrelated commit — which is why returning `[]`/`false` on
`committed: false` is honest rather than lossy.

Cross-file reliance (not defects here): the caller in `daemon-services.ts` L232-236 answers
`stillRunning` with `running.some(a => a.startedAt >= since)` — a *lexicographic* comparison of two
`toISOString()` strings (same fixed-width format, so it orders correctly) over **any** of this machine's
running agents, not the routine's own. That over-approximation is exactly what the SPEC prescribes
("whether any of this machine's own agents started since the lock was minted is still running"), so a
dead routine whose lock outlives an unrelated younger agent simply waits out the 4 h expiry — intended.
`auto-pm.ts` L1080-1096 releases a lock again when the spawn it was taken for fails, and L828 releases on
run end, so the acquire/release pairing is closed on both sides.

## Functions (low-level)

- `ROUTINES_DIR` / `ROUTINE_LOCK_TTL_MS` — constants; the TTL is `4 * 60 * 60 * 1000`. Correct.
- `routineLockPath(name)` → `routines/<name>.lock.md`. `name` is interpolated raw, so a name containing
  `/` or `..` would escape the routines directory; the only callers pass Auto PM's own fixed routine
  identifiers (`item.lock`), never user input, so the reliance is on the caller, not a reachable flaw.
  Correct.
- `routineLockContent(holder)` — two lines plus a trailing newline. Correct.
- `routineLockHolder(md)` — anchored multiline regexes with `[ \t]*` and a `.trim()`, so `\r` from a
  CRLF file is stripped and `CLAIMED:` with an empty value fails `(.+)` and yields `undefined` (a
  half-written lock is therefore "not a lock" and gets taken over, which matches the glossary).
  A line that only *contains* `CLAIMED:` mid-line cannot match because of `^`. Correct.
- `resolve(deps)` — the injectable seams. Defaults: `read` = `readFile` (rejects ENOENT, and every call
  site wraps it in `.catch(() => '')`), `write` = `mkdir -p` + `writeFile` (so the first lock creates
  `routines/`), `remove` = `rm(path)` without `force` (a file vanishing between list and remove would
  throw and abort the cycle — but the whole cycle is serialized per repo and the data checkout is not
  touched by anything else, so it is not reachable), `list` = `readdir(dir).catch(() => [])` (missing
  directory reads as none, as documented), `log` = no-op. Correct.
- `routineLockExpired(holder, now)` — `Date.parse` NaN ⇒ expired; boundary `>= TTL` is inclusive.
  A `since` in the future (clock skew) yields a negative age and so a lock that stands until the *other*
  machine's clock passes +4 h; harmless and not worth code. Correct.
- `acquireRoutineLock(cwd, name, deps)` — mints `mine` once (before the funnel) so the identity check
  survives re-runs; op resets `held`, reads, and either recognises its own claim, stands down, or writes.
  Result folding order matters and is right: `held` (stand-down) is reported before the commit-failure
  branch, because a cycle that only failed to push a *previous* stranded commit must still report the
  stand-down. `!result.ok && !result.committed` ⇒ "could not be committed"; `!result.ok` with
  `committed` ⇒ taken, with the cross-machine gap logged. Correct.
  Suspicious-but-unproven: two acquires of the *same* routine on the same machine within the same
  millisecond would both see `holder.since === mine.since` and both consider the lock theirs. Not
  reachable in practice — `mine.since` is minted per call and a full funnel cycle (git sync/commit/push)
  plus an agent spawn separates any two calls, and Auto PM never queues the same `item.lock` twice in one
  batch — so it is recorded here rather than reported.
- `releaseRoutineLock(cwd, name, deps)` — removes only while the lock names this host; a missing file
  reads as `''` ⇒ no holder ⇒ nothing removed ⇒ nothing staged ⇒ no commit (the "absent" case in the
  SPEC, and the test asserts no commit message). Returns `result.ok || result.committed`, i.e.
  committed-but-unpushed counts as dealt with — matching the SPEC, though unlike acquire it does not log
  that gap (asymmetry, not a defect). Correct.
- `releaseDeadRoutineLocks(cwd, stillRunning, deps)` — lazy commit message (`() => …`), which
  `withDataBranch` resolves *after* the op ran (data-branch.ts L242-243), so the count is the real one;
  singular/plural handled. `released` is reset per run, so a re-run reports only the final pass. Non-lock
  files under `routines/` are skipped by the `^(.+)\.lock\.md$` regex, and another machine's locks are
  skipped by the host check. Returns `[]` when nothing survived the cycle, which is truthful because the
  funnel's catch restores the checkout. Correct.

## Bugs found

None found.
