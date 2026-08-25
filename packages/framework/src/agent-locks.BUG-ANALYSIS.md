# Bug analysis: packages/framework/src/agent-locks.ts

## Business logic (high-level)

A 41-line in-process mutex, keyed by checkout path, that serializes every git-mutating action
against one agent checkout. The problem it exists for: an agent's meta flips to `done` from the
child process, so the dashboard offers Push / Open PR / Remove / Delete / Resume a beat before the
daemon's teardown has finished archiving, committing the bookkeeping and retiring the worktree.
Both actors are in the same daemon process (dashboard RPCs are served in-process, only the daemon
writes to the project checkout), so a process-local lock is a complete fix — `agent-locks.SPEC.md`
states this explicitly ("there is no second process to coordinate with"), which is why there is no
lockfile, no fs advisory lock, no lease/TTL. That is a deliberate design bound, not a gap.

Invariants the module must uphold, per SPEC:

1. **One checkout, one action at a time, in arrival order.** Holders of the same key run strictly
   serially; the order is the order in which `withAgentLock` was *called* (not the order in which
   the predecessors settle), because the chain is built synchronously at call time.
2. **Different checkouts never contend.** Keys are independent map entries.
3. **A failure never skips the queue.** A rejected holder must not cancel, reorder or poison the
   waiters behind it; each caller gets exactly its own result/error.
4. **Path spellings of one checkout collapse to one key** (`resolve`).

Lifecycle: `chains` is a module-level `Map<string, Promise<unknown>>` that holds, per key, the
*settlement* promise of the most recently enqueued holder. An entry exists only while a holder is
outstanding — the last holder deletes its own entry in a `finally`, guarded by identity so it never
deletes a successor's entry. That identity guard is what makes the map bounded: a daemon that runs
thousands of agents does not accumulate one entry per checkout forever.

Concurrency/ordering reasoning (the part worth checking carefully):

- `const prev = chains.get(key) ?? Promise.resolve()` then `chains.set(key, settled)` happen with no
  `await` between them, so enqueueing is atomic with respect to other JS. Two synchronous calls in
  the same turn chain correctly (second sees the first's `settled`).
- Waiters chain on `settled`, which is `agent.then(noop, noop)` — a promise that can only fulfil.
  So a rejected holder cannot reject the successor's `prev`, satisfying invariant 3. The
  `prev.then(fn, fn)` double-handler is belt-and-braces for the same property (only reachable for
  the `Promise.resolve()` seed, which never rejects) — harmless, not dead-wrong.
- Deletion race: could a successor's entry be deleted by a predecessor's `finally`? No. The
  predecessor deletes only if `chains.get(key) === settled` (its own promise). A successor always
  overwrites the entry synchronously at enqueue time, so the identity check fails and the entry
  survives.
- Could the entry be deleted while a waiter is still queued behind it? Same guard says no: if a
  waiter enqueued, the map no longer holds the finishing holder's `settled`.
- Could a late acquirer chain onto a stale, already-deleted entry? Deletion happens only when the
  finishing holder is the last one, i.e. its `agent` has already settled; a later acquirer then
  sees no entry and starts immediately — which is correct, nothing is running.
- Unhandled rejections: `agent` always has a rejection handler attached (`settled`) plus the
  `await` in the `try`, so a failing holder never produces an unhandled-rejection warning inside
  this module. The promise `withAgentLock` *returns* is the caller's to handle; all seven call
  sites await or return it.

Known, deliberate limits (not bugs): a holder whose `fn` never settles pins the key forever (no
timeout by design — a stuck git is a stuck git); re-entrant acquisition of the same key from inside
`fn` would self-deadlock (no call site does this — the seven callers in `daemon-runtime.ts`,
`merged-worktrees.ts`, `dashboard-rpc/control.ts` and `e2e/harness.ts` all call the inner work
functions directly, none of which re-acquire); `resolve` normalizes `.`/`..`/relative segments but
does not `realpath`, so two symlink spellings of one checkout would be two keys — every call site
derives the path from `worktreePath(cwd, agentId)` or the agent's recorded `checkout`, both built
from the same project cwd, so the divergent-spelling case does not arise in this system.

## Functions (low-level)

### `chains` (module-level `Map<string, Promise<unknown>>`)

Per-key tail of the wait chain. Value type is `Promise<unknown>` but every value stored is the
`Promise<void>` from `agent.then(noop, noop)`; the wider type is only cosmetic. Bounded by the
identity-guarded delete. Module state, therefore shared across the whole daemon process and across
tests in one test file — the tests are written to leave it empty (each awaits its holders), so this
is fine.

### `withAgentLock<T>(checkout: string, fn: () => Promise<T>): Promise<T>`

Input: any path spelling of a checkout, and the work to run under the lock. Output: exactly what
`fn` resolves/rejects with, untouched.

Edge cases considered:

- *Empty/relative `checkout`*: `resolve('')` → `process.cwd()`; a relative path resolves against
  cwd. No caller passes either (all pass absolute paths built from the project cwd), and both
  behaviours are still self-consistent (same input → same key).
- *`fn` throws synchronously*: it is invoked from `prev.then(fn, fn)`, so a synchronous throw is
  converted to a rejection by the `then` machinery — the lock still releases, the caller still gets
  the error. Correct.
- *First acquisition*: seeded with `Promise.resolve()`, so `fn` starts on the next microtask rather
  than synchronously. Callers are all `async`, so this is invisible.
- *Two acquisitions in one synchronous turn*: correctly ordered (see above).
- *Failure then reacquire*: the failing holder's `settled` fulfils, the successor runs. Verified by
  the test at `agent-locks.test.ts:41`.
- *Off-by-one/leak*: the `finally` runs on both success and failure paths, so the entry is always
  released.

Verdict: correct.

## Bugs found

None found.
