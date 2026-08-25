# Bug analysis: packages/framework/src/data-branch.test.ts

## Business logic (high-level)

Integration suite for the `tf-data` data branch (`data-branch.ts`), run against **real** git: real
temp repos, a real bare origin, and a second clone standing in for "another machine". No seams are
injected — `nodeGitRunner()` throughout — so the tests pin observable git state (refs, blobs on the
bare remote, `status --porcelain`, `readlink`) rather than call sequences. That is the right shape
for this module, whose whole contract is about what git ends up holding.

Fixtures:

- `initRepo(prefix)` — `git init -b main`, identity config, one commit. `realpath()`'d so paths
  compare equal to what git reports (macOS `/var` → `/private/var`); this matters because
  `dataWorktreePath()` is built from the passed `cwd` and the test compares files under it.
- `initSyncedRepos()` — repo + bare origin + a second clone (`other`) with its own identity. Its
  `cleanup` removes repo, bare and the clone's parent with `maxRetries: 10` (the macOS ENOTEMPTY
  teardown race the daemon-workspace suite hit).
- `otherMachineWrites(other, file, content)` — the "remote writer" that the SPEC says the race is
  settled against: adopt `origin/tf-data` if origin has it, else *birth its own* parentless history
  from the empty tree, write, commit, push. The else-branch is what makes the two convergence tests
  genuinely adversarial — the local and remote data histories are then **unrelated**, which is the
  worst case the rebase/reset logic can meet.

What the suite pins, mapped to `data-branch.test.SPEC.md`:

1. **Birth** — branch checked out at the worktree path, parentless (`merge-base tf-data main`
   rejects), queue seeded empty, relative root `tickets` symlink, link excluded from git *while*
   the data checkout's own `tickets/` still commits (the `/tickets` + `!/tickets/` exclude pair),
   idempotent second ensure.
2. **Pre-existing `tickets` path is left alone** — content unchanged *and* still `?? tickets` in
   status. The second assertion is the important one: it pins that the exclude pair is written only
   inside the "link was created" branch, so the framework never hides a path it did not create.
3. **Adoption** — with origin already holding the branch, ensure adopts it (the checkout has the
   other machine's queue) instead of birthing a second history.
4. **A write** — `{ok, changed, pushed}` all true, blob visible **on the bare origin**, `main` ref
   byte-identical before/after (the "code branches stay 100% code" invariant), and the caller's own
   commit subject on the remote.
5. **No-op write** — `{changed:false, pushed:false}` and the branch ref unmoved. Verifies the
   `status --porcelain` gate, not just the return value.
6. **Remote-less write** — lands locally, `pushed:false`, blob readable from the local branch.
7. **Convergence with a stranded commit** — a hand-made local commit (standing in for an earlier
   cycle that could not push) plus a remote write on an unrelated history: after one write all
   three files exist on origin. Exercises `syncCore`'s clean-rebase path across unrelated histories
   *and* the owed-push rule.
8. **Conflicting stranded commit** — both sides rewrote `TODO_AGENTS.md`: the rebase conflicts,
   `syncCore` aborts and hard-resets to origin, the op re-reads and appends, and the remote blob is
   `origin view\nappended`. This is the strongest test in the file: the assertion would fail both if
   the local stale copy won and if the op had been applied to the pre-reset content.
9. **Eager pull** — `pullDataBranch` alone converges the checkout on what the other machine pushed.
10. **Serialization** — three concurrent `withDataBranch` calls; asserts the exact
    `a:start,a:end,b:start,b:end,c:start,c:end` order **and** that all three appends survive. This
    is a real ordering assertion, not a "no crash" one: any interleaving flips the array, and any
    lost update flips the file contents.

Determinism check on (10): `withDataBranch` is `async` but its body reaches `return serialize(...)`
with no `await` before it (`resolveDeps` and `dataWorktreePath` are synchronous), so the three calls
join the chain synchronously in `map` order — the strict `a,b,c` expectation cannot flake.

Coverage gaps (not defects in these tests, but worth recording, since they are why the source's
worst bug survives review): nothing here ever makes a **push fail**, so the retry arm of
`withDataBranch` — the one that re-runs a non-idempotent `op` on top of its own surviving commit,
and the one that returns `{ok:false, committed:true}` — is entirely unexercised. Likewise
`readDataFile`'s three fallback sources and `dataProjectRoot` have no test here at all, and the
"stranded commit dropped by a conflicting eager pull" path (`pullDataBranch` over a conflicting
local commit) is not covered — the conflict test always has a live op to re-apply the intent, which
is exactly the case where the loss is invisible.

## Functions (low-level)

- **`initRepo(prefix)`** — `mkdtemp` + `realpath` + init + identity + one commit. `-b main` needs
  git ≥ 2.28; the rest of the repo assumes the same. No default-branch or `init.defaultBranch`
  leakage because the branch is named explicitly. Correct.
- **`initSyncedRepos()`** — bare origin created with `git init --bare <bare>` run *inside* `bare`
  (harmless duplication of cwd and arg). The clone gets its own identity, so commit authorship
  cannot fall back to a missing global config in CI. `cleanup` deletes `otherParent` rather than
  `other`, so the clone's parent temp dir does not leak. Correct.
- **`otherMachineWrites(other, file, content)`** — the fetch probe is a `then(true,false)` pair, so
  "origin has no such branch" is a clean `false` rather than a rejection; the else-branch hashes
  `/dev/null` as a tree and falls back to the well-known empty-tree SHA if that fails. `git
  commit-tree` against the empty tree works even though the object was never written, because git
  special-cases the empty tree/blob — the same assumption `data-branch.ts`'s `EMPTY_TREE` constant
  makes, so the helper cannot be more fragile than the code under test. `/dev/null` makes the helper
  POSIX-only, consistent with the rest of the suite (symlinks, `realpath`). Correct.
- **Test 1 (birth/seed/link)** — the parentless check is `assert.rejects(merge-base tf-data main)`,
  which is exit-1-on-no-merge-base; it would also pass if `merge-base` failed for another reason,
  but the preceding `rev-parse --abbrev-ref HEAD` assertion already proves the branch exists, so the
  check is not vacuous. The exclude assertions are a matched pair (no `?? tickets` at the repo root,
  yet `tickets/t.md` committable from the data checkout) — that pair is exactly what catches a
  single-rule exclude that would swallow the branch's own cargo. Correct.
- **Test 2 (pre-existing `tickets`)** — the positive `?? tickets` assertion is the guard against a
  regression that writes the exclude unconditionally. Correct.
- **Test 3 (adoption)** — asserts the *content* of the adopted queue, so a second parentless birth
  (which would leave the file empty) fails it. Correct.
- **Test 4 (write)** — the blob is read from `bare`, i.e. the push is verified at the destination,
  not from the local ref. `main` unmoved is checked by ref SHA. Correct.
- **Test 5 (no-op)** — ref SHA unmoved before/after. Note it deliberately runs on a remote-less repo
  so the `!remote` early return is the path taken; the owed-push arm of a no-op write (`ahead`
  true after an earlier stranded commit) is covered indirectly by test 7. Correct.
- **Test 6 (no remote)** — pins the "a repo with no remote is fine for a *write*" half of the SPEC;
  the "error for a *sync*" half (`pullDataBranch` without a remote) is not tested here. Correct as
  far as it goes.
- **Test 7 (converge + carry stranded)** — the three-file loop asserts each blob on the bare origin
  with the file name as the assertion message, so a failure names the missing one. Correct.
- **Test 8 (conflict resolves toward origin)** — the op reads through `.catch(() => '')`, so if the
  reset had removed the file the appended result would be `- [ ] appended\n` and the assertion would
  still fail. Correct, and the strongest assertion in the file.
- **Test 9 (eager pull)** — reads the checkout file after `pullDataBranch`; does not assert the
  returned `DataSyncResult`, so a pull that converged *and* reported `{ok:false}` would pass. Minor
  weakness, not a defect.
- **Test 10 (serialization)** — see determinism note above; asserts both order and surviving
  content. Correct.

## Bugs found

None found.
