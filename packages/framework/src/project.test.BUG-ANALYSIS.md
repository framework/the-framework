# Bug analysis: packages/framework/src/project.test.ts

## Business logic (high-level)

Covers `project.test.SPEC.md` faithfully:

- **Activation** — marker present → true; absent → false, via a `ProjectFs` fake keyed on exact paths (uses the real `gitignorePath`, so a path drift between production and test would fail).
- **Crawl** — NUL parsing with trailing NUL, dedupe, sort, argument capture (`deepEqual` on the exact git argv — pins `--exclude-standard` et al.), and failure → `[]`.
- **Budgets** — a table of 22 real invocations from the #997 call-site inventory, each asserted against its class; plus: the three constants pinned to 10s/30s/120s so "widen reads to fix a slow op" fails a test; slow > 2× read sanity checks; unknown/empty → write (not slow); leading flags, separate-value globals (`-C`, `-c`, `--git-dir`, `--work-tree`, `--namespace`, `--exec-path`), inline `--opt=value`, and globals before `worktree` all classified right.

Do the tests verify what they claim? Yes — each `gitTimeoutMs` case is a strict equality against a distinct constant, so any classification regression flips at least one. The generated `for (const {args, ms} of BUDGETS)` loop names each test by the argv, so a failure is attributable. The crawl tests assert both output and the exact command issued.

Notable coverage choices:

- `['branch', '--list', '--merged', 'main', 'topic']` is asserted as READ — consistent with the implementation's coarse `branch`→read rule; a branch *creation* under the read budget is not exercised (see source analysis; harmless in practice).
- The crawl trim behavior (whitespace-edged filenames, see `project.BUG-ANALYSIS.md` bug 1) is not pinned — the tests only feed clean names, so they neither require nor forbid the trim. The bug is therefore invisible to this suite.
- No test drives `nodeGitRunner` against real git — right call for a unit suite; the timeout plumbing is `cli-exec.ts`'s to test.

Async handling: crawl tests await; budget tests are synchronous. Fakes return plain resolved values. Nothing can pass vacuously (every assert compares concrete values).

## Functions (low-level)

- **`fakeFs(files)`** — membership-based `exists`. Correct.
- **crawl agent fakes** — capture `{args, cwd}`; the failure fake throws. Correct.
- **`BUDGETS` table + loop** — data-driven tests; `ms` referenced from the exported constants rather than literals, so the table tracks intent (the separate pin test keeps the constants themselves honest — good two-layer design; either alone would be circular or brittle).

## Bugs found

None found.
