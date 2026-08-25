# Bug analysis: packages/framework/src/archived-agent-patch.test.ts

## Business logic (high-level)

Integration tests against real git (temp project + bare origin), pinning exactly what the
test-SPEC promises: (1) a patch lands as a commit on `tf-data`, pushed, checkout clean, and the
patched record survives the daemon's next data sync; (2) an agent with no archive reports
not-patched and moves HEAD not at all.

The fixture (`repoWithArchive`) seeds one archived run through `withDataBranch` itself and
asserts `seeded.ok && seeded.pushed`, so a broken funnel fails loudly in the fixture instead of
producing a vacuous pass later. `commit.gpgsign false` and explicit user identity make the tests
hermetic against host git config. Cleanup removes both temp dirs in `finally`.

Do the tests verify what they claim?

- Test 1 asserts the *strong* forms, each of which can fail independently:
  - the JSON on disk carries branch+PR after the call (the write happened);
  - `git status --porcelain` empty (committed, not merely written — the exact hazard the SPEC
    names, since a dirty tree is what the next sync hard-resets);
  - `git log -1 --format=%s` equals the caller's message (the patch is its own commit, not riding
    a later one);
  - `rev-list --count origin/tf-data..tf-data` is 0 (pushed);
  - a subsequent `withDataBranch(...data sync...)` (what `pullDataBranch` runs) leaves the
    patched branch value in place — the survives-the-sync claim, tested against the real rebase
    path. All meaningful; none can pass trivially.
- Test 2 compares `rev-parse HEAD` before/after and the boolean `false`. Since `withDataBranch`
  commits only when `git status` shows staged changes, an accidental commit (e.g. a stray write)
  would move HEAD and fail. Sound.

## Functions (low-level)

- **`repoWithArchive()`** — builds project + bare origin, wires `origin`, seeds
  `agents/u/r1.json` + empty `r1.jsonl` through the funnel. The seeded meta is a plausible
  `AgentMeta` (`status: 'done'`, id `r1`); `isSafeAgentId('r1')` holds. The dir `agents/u/` gives
  `archiveDirs` a committed user dir to find. Uses `mkdtemp` under `tmpdir()` — unique per run, no
  cross-test interference; `withDataBranch`'s per-`cwd` serialization keys on the unique temp path,
  so parallel test files cannot contend. Verdict: correct.
- **Test 1** — end-to-end as described above. One nuance: `dataWorktreePath` is computed before
  the call, but the fixture's seed already created the worktree, so reading files there is safe.
  Verdict: correct.
- **Test 2** — patches id `nope` (absent). `patchArchivedAgent` returns false, funnel commits
  nothing (no staged change), HEAD unchanged. Also implicitly covers the "no commit even though
  the funnel ran" claim. Verdict: correct.

Minor observations (not bugs): the tests do not cover the unsafe-id refusal at this level (covered
in `agent-store.test.ts` L686) nor the push-failed/owed-push branch of the wrapper's return value
(`committed:true` → still `true`); the latter is the funnel's own contract, tested in
data-branch's suite. The fixture writes the meta with bare `JSON.stringify` — consistent with what
`patchArchivedAgent` itself does today (see the sibling analysis for why that encoding choice is
itself questionable in the source).

## Bugs found

None found.
