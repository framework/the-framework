# Bug analysis: packages/framework/src/cloud-work.test.ts

## Business logic (high-level)

Tests for the #1601 adoption pass, covering exactly what `cloud-work.test.SPEC.md` promises: ancestry matching (one head adopts; zero or two adopt nothing; a pre-anchor fork is ruled out by real git), what is recorded vs opened (session's own PR recorded and not doubled; armed draft opened; unarmed run records branch only; anchor-only head gets no PR; an adopted-but-PR-owed run is re-asked without re-recording the branch), which runs are considered (non-web / running / anchorless / fully answered / too old are skipped, and with nothing waiting no fetch happens), the failure discipline (unreachable remote never throws; a failing PR listing records the branch, opens nothing, reports), the foreign-branch guard, and the recurring service (join overlapping ticks, log adoptions+failures, stopped runs nothing).

The fixture design is sound: `fakeGit` answers `fetch` and `for-each-ref --contains=<anchor>` from a declarative `descends` table and formats output exactly as git would (`<sha> refs/remotes/origin/claude/<name>`), so the production parser is exercised. The integration test (`repoWithCloudHeads`) builds a bare origin, the daemon checkout, and a separate "cloud VM" clone, pushes the `claude/*` branches only from the clone (so the checkout under test provably has never seen them — asserted), and verifies both the refspec (standing remote-tracking refs exist after the pass) and the ancestry query (only the descendant matches; the stranded anchor matches nothing). Temp dirs are cleaned in `finally`.

Do the tests verify what they claim? Yes — each assertion targets the recorded side-effects (`recorded.branches/prs/opened`) and/or the returned result, not just absence of a throw. The "nothing waiting means not even a fetch" claim is pinned via `git.calls`. The window-at-the-store claim (#1607) is pinned by capturing the `since` handed to the `agents` seam.

## Functions (low-level)

- `webRun(over)` — a canonical done web run: `startedAt` matches the id (`2026-08-20T10-00-00-000Z`), `cloudAnchor` set, birth branch `tf-agent-<ID>`. Overrides compose correctly (e.g. dropping `cloudAnchor` via destructuring at line 141). Correct.
- `fakeGit(heads, descends)` — records calls; `for-each-ref` reads the anchor from `args[1]` which matches the production arg order (`['for-each-ref', '--contains=…', '--format=…', prefix]`). Throws on unexpected commands so a changed dialect fails loudly. Correct.
- `deps(agents, git, prs)` — wires all seams; `patch` records branch/pr patches separately; `openPr` returns `{ ok: true, url, number: 7 }`. `now` fixed one hour after start (inside the window). Correct.
- Individual tests: each was traced against the implementation; the expected values are what the code produces (e.g. the two-heads case supplies both shas as descendants of the anchor so `matches.length === 2`; the too-old run is `CLOUD_ADOPTION_WINDOW_MS + 1000` before `now`, strictly outside; the failure test asserts the `could not list the PRs` message the code emits). The service test asserts the `draft PR` and failure substrings the production log lines contain, and that a stopped service ticks as a no-op.
- `repoWithCloudHeads()` — sets git identity and `commit.gpgsign false` in both writable repos, creates two anchors (one to be built on, one stranded), pushes them as `tf-agent-*` refs, then pushes `claude/this-run` (descends from anchor) and `claude/not-this-run` (forked at base) from the clone. The unarmed handoff in `seams` keeps the integration test off the PR path (no `gh` dependency). Correct.
- The integration test resets `recorded.length = 0` between the matched and stranded runs, so the second assertion is not satisfied by leftovers. Correct.

Edge notes (not bugs): the suite never pins the `stopped`-mid-pass behavior of `passAll` (only stop-before-tick), and never exercises `openPr` returning `{ ok: true }` without a number — both are minor coverage gaps, not wrong tests. Temp fixtures use `tmpdir()`, consistent with the rest of the suite.

## Bugs found

None found.
