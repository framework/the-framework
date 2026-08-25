# Bug analysis: packages/framework/src/ticket-locks.test.ts

## Business logic (high-level)

Unit tests for `ticket-locks.ts`, run entirely off disk and git behind a fake write funnel. The
central fixture is `checkout()` (L27): an in-memory `Map` standing in for the data-branch checkout,
plus a `funnel` that mimics `withDataBranch`'s three observable behaviours —

1. it runs the op against the checkout path,
2. it resolves the commit message **after** the op (so a thunk sees the final count), and only when
   something actually changed and the cycle committed,
3. it can re-run the op (`runs: 2`) the way the real funnel does after a lost push race, and it
   restores the map when a cycle failed whole (`!ok && !committed`), the way the real funnel
   `reset --hard`s the checkout.

That fake is a faithful model of `data-branch.ts` L233-266 on every axis the module under test can
observe: message-after-op (L242-243 there), the `changed`/`committed` split of `DataWriteResult`,
and checkout restoration on total failure. Two deliberate simplifications: the fake does not
re-sync between runs (the real funnel's re-run sees origin's fresher state), and it never simulates
a *changed* judgement drifting between runs. Neither weakens the assertions that exist.

What the suite pins down:

- one `.lock.md` per assignment, correct content, and a commit message naming the batch count;
- an existing lock or (for a `plan` batch) an existing plan is skipped, not overwritten, and the
  existing file is asserted byte-identical afterwards;
- the `drain` phase flips the plan verdict while keeping the lock verdict;
- the three funnel outcomes: failed-whole → `[]` and no lock on disk; failed-whole → error logged
  *with the error text* even though nothing was claimed; committed-but-unpushed → claims kept plus
  a log naming the count;
- the re-run invariant — one claim and one `lockMessage(1)`, i.e. `locked` is rebuilt per run
  rather than accumulated, and the second run's "the lock already names me" branch (source L138)
  is what makes the claim survive;
- the default `write` really creates `tickets/` (the one test that touches real fs, in a `mkdtemp`
  directory with a `finally` cleanup);
- release: released / no-lock / error / committed-but-unpushed, plus all three `heldBy` outcomes
  (frees its own claim with the abandoned-release message, leaves another holder alone with
  nothing committed, `no-lock` when the file is gone);
- the two pure helpers.

Every async assertion is awaited (`assert.equal(await ...)` or `await` before the asserts), so no
test can pass by not running. Each test builds its own `checkout()`, so there is no shared mutable
state between tests and no ordering dependency.

## Functions (low-level)

### `checkout(files, opts)` (L27)

Builds `disk` (a `Map` keyed by absolute path under `DATA`), `logs`, `messages`, and a `deps`
object wiring `write`/`read`/`remove`/`log`/`funnel` to that map. `read` throws on a missing key,
matching `fs.readFile`'s ENOENT, which is what the module's `.then(ok, fail)` probes rely on.
`changed` is computed as "size differs, or some current entry differs from its previous value" —
correct for this suite: a pure deletion changes the size, and a pure addition or content change is
caught by the `some`. (A same-size add+delete pair would also be caught, since the added key's
`before.get` is `undefined`.) Correct.

### The eight `acquireTicketLocks` tests (L60-186)

- L60: happy path, two tickets, asserts content and `lockMessage(2)`. Real assertion.
- L76: mixed fixture; asserts `['c.md']` locked, the foreign lock untouched, and no lock written
  for the planned ticket. Real.
- L100: same fixture, `'drain'` phase; asserts the opposite verdict on `b.md`. This pair is the
  strongest test in the file — it isolates the phase as the only difference.
- L123 / L135: failed-whole. The second asserts the error text is *in* the log line, which is the
  point of the "logged even for an empty batch" rule.
- L146: real-fs test of the default `write` seam, correctly using `mkdtemp` + `finally` cleanup.
  Note it passes `{ funnel }` only, so `read`/`log` fall through to their real defaults — that is
  intentional and exercises the default `read` returning ENOENT for the absent lock.
- L165: committed-but-unpushed; asserts the count is in the log line.
- L177: the re-run invariant, asserting both the disk state and that exactly one message was
  produced with count 1.

### The six `releaseTicketLock` tests (L188-242)

Cover `released` (with the message), `no-lock` (asserting *nothing committed*), `error` (asserting
the lock survives), committed-but-unpushed (asserting the release stands and the gap is logged),
and the three `heldBy` branches. The `not-holder` test asserts both the untouched file and the
empty `messages` array, which is the thing that matters: the op must return before removing, so the
funnel has nothing to commit.

### `ticketLockHolder` / `ticketLockName` tests (L244-254)

Table-style. The holder cases cover the round-trip, leading whitespace plus a holder containing
spaces and parentheses, a non-claim body, a claim line with an empty holder, and the empty string.
Correct and meaningfully falsifiable.

## Coverage gaps (not bugs)

- Nothing tests a batch containing two assignments for the same ticket. With the real `fs` seams
  the sequential loop makes the second a "someone else's lock" skip; with this fixture's map it
  would behave the same, so the behaviour is safe but unpinned.
- Nothing tests unparseable lock content (a `.lock.md` whose first line is not `CLAIMED:`) in
  `acquireTicketLocks`: it is treated as a foreign claim and the ticket is skipped. Reasonable, but
  unpinned.

## Bugs found

None found.
