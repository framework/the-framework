# Bug analysis: packages/framework/src/dashboard/docs.test.ts

## Business logic (high-level)

Five tests over `readDocs` and `DOC_CATEGORIES`. Two of them build a **real git repository** with a
real data branch (`repoWithQueue`), because the backlog is read off that branch rather than the
working tree since #1582 — a fake would not exercise the thing the test is about. The other three
use a plain temp directory.

What is pinned, matched against `docs.test.SPEC.md`:

- Sidebar order: `PLAN.md` before the data-branch backlog, and within a category the flat file before
  the scoped ones.
- The backlog comes off the data branch, and a leftover root `TODO_AGENTS.md` does not shadow it.
- Session-scoped `PLAN_…`/`TODO_….agent.md` are surfaced; an unrelated `README.md` is not.
- Missing and blank documents are skipped; a non-existent workspace reads as `[]` rather than
  throwing.
- The category patterns cannot express a path.

**Do the tests actually verify what they claim?** Yes, and two of them are unusually strong:

- `:56` writes a *different* body into the root copy (`'- [ ] stale checkout copy\n'`) than into the
  data branch (`'- [ ] roadmap\n'`) and asserts the content, not just the name. That is the only way
  to tell "read from the branch" from "read from the root" — asserting the name alone would pass
  either way, since both spellings are `TODO_AGENTS.md`.
- `:82` asserts the *negative* cases of the scoped regexes with concrete traversal attempts rather
  than eyeballing the pattern.

**Cleanup and isolation.** Every test wraps its body in `try/finally` with `rm(..., {recursive: true, force: true})`,
so a failing assertion still removes the temp tree. `repoWithQueue` calls `realpath` on the temp dir
(macOS `/tmp` → `/private/tmp`), which matters for the git worktree paths `withDataBranch` builds;
the two non-repo tests skip `realpath` and do not need it, since `readDocs` never compares paths.

**Environment reliance worth recording.** `repoWithQueue` shells out to real `git` (`init`, `config`,
`commit`) with `user.email`/`user.name` set locally, so it does not depend on the machine's git
identity. It does depend on `git init -b main` (Git ≥ 2.28) and on `withDataBranch` succeeding —
asserted at `:23`, so a failure there reports as an assertion rather than as a confusing downstream
`deepEqual` mismatch. Good practice, not a bug either way.

**Not covered:** the `MAX_DOC_BYTES` truncation path and its `… (truncated)` marker; a `PLAN.md`
present but unreadable; and the sorting of *several* scoped files within one category (only one of
each exists at `:40`). Coverage gaps, not defects.

## Functions (low-level)

### `repoWithQueue(md)` (L11)

Creates a temp repo, makes one commit (a data branch needs a repo with a HEAD), then writes
`TODO_AGENTS.md` into the data branch through `withDataBranch`. Asserts `seeded.ok` before returning,
so the fixture fails loudly. Returns the repo path. *Verdict:* correct.

### `'returns the surfaced docs, PLAN before the data-branch backlog (#319/#1582)'` (L27)

Asserts both names *and* both bodies. The order assertion is meaningful because the two categories
are independent sources — a regression that read the backlog first would flip it. *Verdict:* correct.

### `'surfaces session-scoped PLAN_/TODO_ .agent.md files (#323/#326)'` (L40)

Writes four files, three of which should be surfaced, and asserts the exact three-name list. Note
this test runs against a plain temp dir (no git), so the backlog's `readDataFile` finds nothing and
`TODO_AGENTS.md` is correctly absent from the expected list — the test would fail if the flat backlog
were ever read from the workspace root instead. A quiet second guard on the #1582 behaviour.
*Verdict:* correct.

### `'reads the backlog off the data branch, never a checkout copy (#682/#1582)'` (L56)

See above — the content assertion is what makes it discriminate. *Verdict:* correct.

### `'skips missing and blank docs, and never throws'` (L69)

`PLAN.md` is `'   \n\n'` (whitespace only) → dropped by the `trim()` check; `TODO` absent. Then a
path that does not exist → `[]`. Both halves assert `deepEqual([])`, which would fail if a blank doc
leaked through as `{name, content:'   \n\n'}`. *Verdict:* correct.

### `'DOC_CATEGORIES match fixed roots + slug-only scoped names (no traversal)'` (L82)

Loops both categories asserting the flat name has no separator or `..`, and that two traversal
spellings fail the scoped pattern; then two positive cases. Synchronous, no I/O. *Verdict:* correct.

## Bugs found

None found.
