# Bug analysis: packages/framework/src/todo-loop.test.ts

## Business logic (high-level)

Integration-leaning tests for `todo-loop.ts`. Unusually for this repo they use **real git**: the
queue lives on the data branch since #1582, so `repoWorkspace()` builds an actual repo (`git init`,
a commit) and `seedQueue()` writes the queue through the real `withDataBranch` funnel — the same
path every production writer takes. Assertions about the resulting queue read it back with
`git show tf-data:TODO_AGENTS.md`, i.e. the *committed* state, not a working-tree file. That is the
right level: the whole point of #1582 is that the queue is not a checkout file, and a test that
asserted against `join(repo, 'TODO_AGENTS.md')` would pass for the wrong reason.

Every temp directory is removed in a `finally` with `{recursive, force, maxRetries: 10}` (the retry
count matters on the data worktree, which git may still hold). `repoWorkspace()` resolves
`realpath` so macOS `/private/var` symlinking cannot break path comparisons.

What the suite pins down:

- **Grammar**: which lines are open entries (checked, blank-text, prose, headings all excluded),
  that priority headings need no parser support, and `checkOffEntry`'s four cases (retire the named
  entry, give a bare bullet a checked box, no-op on an absent entry, no-op on an already-checked
  one).
- **Location**: the queue is read off the data branch and *only* there — one test deliberately
  plants `TODO_AGENTS.md` and `TODO.md` in the working tree and asserts `findTodoBacklog` still
  answers `undefined`. That is the strongest anti-regression test in the file.
- **Writes**: creation on first append, append-to-same-file on the second, and the worktree case
  (an agent calling from `.the-framework/branches/tf-agent-x` still funnels to the repo's data
  branch).
- **The loop**: works to empty and checks each entry off itself; emits no gate headless; narrates
  the opening count, each item and the completion; gates per item interactively with the right ids
  and labels and stops on `stop`; stalls (with the queue left intact) when the funnel cannot write;
  honours the item cap and reports the remainder; nests an await gate inside an item's turn;
  exits immediately on an already-aborted signal; forwards every turn signal
  (`show-markdown`/`error`/`set-session-name`/`ready-for-merge`); and emits `ready-for-merge` once
  across a two-item backlog (the shared `createTurnSignalEmitter`).
- **Placement**: six `insertTodoEntry` cases covering all four branches plus the format's glossed
  heading, and one end-to-end test that ranked and unranked appends interleave correctly.
- **Ticket labelling**: `nextQueuedTicket` skips a checked first entry, answers `undefined` when the
  first open entry is plain text (deliberately *not* "the one below it"), and `ticketForPrompt`
  only labels a drain — including the whitespace-padded textarea case — and swallows a throwing
  read.
- **Cross-module agreement**: `AUTO_PM_DRAIN_JOB.drains === true` *and* `drainsQueue(its prompt)`,
  with every other auto-PM job asserted not to be a drain. This is the test that keeps a hand-fired
  drain and the sweep's drain the same thing.
- **`agentTodoPending`**: session file only, open vs all-checked, no name, and a name with a path
  separator.

The stall test is the cleverest fixture: it removes the data worktree and writes a *file* at that
path, so `git show` still reads the branch (the loop can still find entries) while every write
cycle fails at `ensureCore`. That isolates "the check-off cannot land" from "the queue cannot be
read", which is exactly the condition `reason: 'stalled'` describes.

Awaiting: every async test body awaits its assertions (`assert.equal(await ...)` or `await` before
the asserts), and `runTodoLoop` is awaited in all six loop tests. No test can pass by not running.

## Functions (low-level)

### `tmpWorkspace()` (L17) / `repoWorkspace()` (L22) / `seedQueue()` (L34) / `queueOnBranch()` (L42)

Fixtures. `seedQueue` asserts the funnel actually landed, so a broken fixture fails loudly instead
of producing a mysterious "no backlog". `queueOnBranch` reads the committed blob. Correct.

### L46 / L68 — parser tests

Table-style, `deepEqual` on the full entry list, so an extra or missing entry fails. The second
test's fixture is the format's own four-section shape. Correct.

### L90 — `checkOffEntry` cases

Four exact-string assertions against one fixture; the no-op cases assert byte-identity with the
input. Correct.

### L100 / L120 — location tests

The second is a negative test with three planted decoys. Note it also creates a `tickets-plain`
directory, a leftover from an older fixture that no longer proves anything — harmless.

### L133 / L148 / L384 — write tests

Assert the committed blob after each call. L148 adds a real `git worktree` and calls from inside it,
which is the only test covering `dataProjectRoot`'s "resolve the repo from a worktree" branch.
L384 additionally asserts the retired session-scoped file is left untouched. Correct.

### L161 / L195 / L208 / L235 / L255 / L270 / L303 / L317 / L366 — loop tests

Each asserts the *full* result object with `deepEqual` (not just `reason`), plus the resulting
committed queue, plus the narration. L208 pins both gate ids and the option label, which is what
makes the "distinct id per item" behaviour a contract rather than an accident. L270 asserts the
exact sequence of emitted choice ids (`['todo-next', 'await-choices']`), pinning that an item turn's
own gate rides inside the loop's turn. L303 uses a non-git temp dir, which is fine because the
abort check precedes any queue read. Correct.

### L403-453 — `insertTodoEntry` placement tests

Six pure tests. They assert relative ordering with `indexOf` comparisons plus a regex on the new
section, and the "joins an existing section" case additionally asserts there is exactly one
`## Priority 5` heading — the assertion that would catch a duplicate-heading regression. L447
covers the format's glossed heading (`## Priority 10 (critical)`), which is the case
`PRIORITY_HEADING`'s `\b` exists for. Correct.

### L455 — `appendFlatTodoEntry` end-to-end

Seeds an unranked file, adds a ranked and then an unranked entry, and asserts the resulting parse
order is `['ranked', 'old', 'unranked']`. This is the one test that proves the two append modes
compose. Correct.

### L468 / L501 / L527 — ticket labelling

L468's fixture deliberately puts a *checked* ticket link above the open one, so the test would fail
if the parser stopped skipping checked entries. L501 covers the drain preset verbatim, the padded
variant, three non-drains, and a throwing read. L527 is a cross-module invariant test with a
per-job failure message. Correct.

### L537 — `agentTodoPending`

Four cases including `'../escape'`. Correct.

## Nits (not bugs)

- `rename` is imported at L3 and never used.
- L126's `mkdir(join(repo, 'tickets-plain'))` no longer contributes to the assertion.

## Bugs found

None found.
