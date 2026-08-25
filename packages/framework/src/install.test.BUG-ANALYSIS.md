# Bug analysis: packages/framework/src/install.test.ts

## Business logic (high-level)

Eight tests over an in-memory `StoreFs` and a scriptable `GitRunner`, covering every clause of `install.test.SPEC.md`: clean-repo single commit, presets materialized, ignore-file content (transient-everything, un-ignore only self + LAYOUT), layout marker written and un-ignored, dirty-repo pre-commit ordering, already-activated no-op that never calls git, git failure surfaced as a value, and non-repo init flow with exactly one commit.

Honesty check of the fakes and assertions:

- `memFs` is faithful where it matters: `exists` = key presence (paths built with the same `join` the code uses, so no separator mismatch); `read` rejects like ENOENT; `mkdir` no-op is fine since the code never lists directories it made. `readdir`'s prefix logic is correct for its (unused-by-install) contract.
- `fakeGit` records args per call; scripts key off `args[0]` — precise enough that a reordering of git calls would show up in the recorded `calls`.
- The "exactly one install commit" assertions use `calls.filter(args[0]==='commit')` with `deepEqual` — pins both count and message; the dirty-repo test pins the *order* of the two messages (`map(args => args[2])` — index 2 is the message for `['commit','-m',msg]`, correct).
- The ignore-content test asserts `/^\*$/m` and `/^!\.gitignore$/m` (anchored, multiline — exact-line matches) and `doesNotMatch(/agents|sessions/)` — the latter guards against the pre-#1582 scheme leaking back; the current comment line ("agent state is transient") does not contain either substring, so no false failure. Slightly brittle to comment rewording, but in the failing-loud direction.
- The layout test asserts marker content equality *and* `/^!LAYOUT$/m` in the ignore — pinning the cross-module invariant that the marker survives `*`.
- The no-op test asserts `calls` is empty — the strongest possible "left completely untouched" check on the git side (fs writes are also implicitly pinned since `files` only holds the seed; not asserted, but a write would be visible; acceptable).
- The failure test scripts `commit` to throw and asserts the exact `{ok:false, error:'nothing to commit'}` value — pins `errorMessage` passthrough too.
- The init test asserts `init` ran and exactly one commit (no dirty pre-commit on an empty fresh repo).

All tests `await` their promises; none can pass vacuously. Coverage gap (noted, not a bug): no test for the half-activated retry path (marker written, later step fails, second install call) — which is exactly where the bug reported in `install.BUG-ANALYSIS.md` lives; a test would have surfaced it.

## Functions (low-level)

- **`memFs(seed)`** — in-memory StoreFs, described above. Correct for its use.
- **`fakeGit(script)`** — call recorder + script. Correct.
- **Eight test bodies** — each maps one-to-one to a SPEC clause; assertions are exact values or anchored regexes. Correct.

## Bugs found

None found.
