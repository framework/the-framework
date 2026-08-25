# Bug analysis: packages/framework/src/archived-agent-patch.ts

## Business logic (high-level)

Records a late fact (branch, PR) onto a settled agent's archived record by funneling the write
through `withDataBranch` — the single serialized sync/apply/commit/push cycle every local data
write uses (#1582). The SPEC (`archived-agent-patch.SPEC.md`) pins: a patch written straight into
the data checkout is not durable (the next sync hard-resets a dirty tree); the outcome is true
when the record carries the patch *committed*; an owed push rides the next cycle; an agent with no
archive reports false and commits nothing.

Key properties checked:

- **Re-runnable op.** `withDataBranch` may run the op twice (push race → re-sync → re-apply).
  `patched` is reassigned on each run, so the last run's answer wins; `patchArchivedAgent` is
  idempotent (spread-merge over the fresh meta), so a second application against re-synced state is
  exactly the intent. Correct.
- **Return value.** `patched && (result.ok || result.committed)`:
  - op found no archive → `patched` false → false, and since nothing changed on disk, no commit is
    made (`git status --porcelain` empty). Matches the SPEC and the test.
  - commit landed, push failed twice → `{ok:false, committed:true}` → true, which is the owed-push
    rule. Matches the SPEC.
  - the funnel failed before/at commit (`{ok:false, committed:false}`) → false; the funnel's catch
    resets the checkout so the half-write cannot ride a later commit. Correct.
- **Edge (noted, not reported):** if attempt 0 committed but its push failed, and attempt 1's
  *sync* then throws (e.g. `reset --hard` errors), the outer catch reports
  `{ok:false, committed:false}` although attempt 0's commit still exists on the branch — the
  function returns false while the patch is in fact committed locally and will ride the next
  cycle. A false negative only; the one caller that branches on it (cloud-work adoption) retries
  idempotently. Not worth code.
- **Transient archives (noted):** `patchArchivedAgent` → `findArchive` also searches the
  *transient* `.the-framework/agents/` dir (an agent with no worktree). A patch landing there is
  outside the data checkout: the funnel stages nothing, no commit is made, and the function
  returns true ("record carries the patch") though nothing was committed — the SPEC's "committed"
  claim is then loose. The transient dir is not touched by the sync's hard reset, so the patch is
  still durable on this machine; and the production callers (cloud adoption, the control RPC's
  PR record) target runs the daemon archived onto the data branch, so the committed dir wins the
  `findArchive` order. Reliance noted, not a bug.

## Functions (low-level)

- **`patchArchivedAgentOnDataBranch(cwd, agentId, patch, message)`** — wraps
  `patchArchivedAgent` in `withDataBranch`. The op ignores the `dataDir` argument and passes the
  project `cwd`; correct, because `patchArchivedAgent` resolves the archive path itself from
  `cwd` (`.the-framework/branches/tf-data/agents/...`) — same root. `message` is passed as a
  string, resolved after the op per the funnel. Unsafe agent ids are rejected inside
  `patchArchivedAgent` (`isSafeAgentId`), so no path traversal. Verdict: correct.

- **Cross-module observation** (defect lives in `store/agent-store.ts`, noticed here because this
  is the funneled writer around it): `patchArchivedAgent` (agent-store.ts L1202) writes the meta
  with a bare `fs.write(archive.meta, JSON.stringify({...meta, ...patch}))` instead of the
  module's `writeMetaFile`. `writeMetaFile`'s own doc (#1540) states it is "the one owner of the
  on-disk encoding … every meta write in this module goes through it", precisely because a plain
  write truncates the file before refilling and a concurrent reader (dashboard poll,
  `readAllAgents` from another process) can see an empty/torn meta — the retry in `readMetaFile`
  "can only paper over, never prevent" it. The patch write also diverges from the encoding
  (single-line, no trailing newline vs pretty-printed + `\n`), so every patch reformats the whole
  archived meta in the data-branch diff. Verdict: bug (minor), fix in agent-store.ts.

## Bugs found

1. `L23` (fix belongs in `packages/framework/src/store/agent-store.ts` L1202): `patchArchivedAgent`
   bypasses `writeMetaFile` — non-atomic truncate-then-write of an archived meta that other
   processes poll, violating the module's stated #1540 invariant, plus a divergent on-disk
   encoding. Scenario: adoption patches `agents/u/<id>.json` while a dashboard poll reads it; the
   reader lands in the truncate window, `readMetaFile` parses `''`, and only its bounded retry
   hides the "agent gone" flash. Severity: minor. Fix: `await writeMetaFile(fs, archive.meta,
   { ...meta, ...patch })`.
