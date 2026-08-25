# Bug analysis: packages/framework/src/agent-locks.test.ts

## Business logic (high-level)

Four `node:test` cases pinning the four invariants `agent-locks.SPEC.md` states. The suite is pure
in-memory: no fs, no git, no timers beyond `setImmediate`; the `/tmp/a`, `/tmp/b` paths are never
touched on disk, they are only map keys. That is legitimate here — the module never touches the
filesystem either.

What the tests actually pin down, and whether they can fail:

1. **Serialization + arrival order** (`L7`): parks the first holder on a manually-resolved promise,
   enqueues a second, drains the microtask queue with one `setImmediate` tick, and asserts the
   second has not run. The tick is sufficient: everything the lock does is microtasks, and a
   `setImmediate` macrotask only runs after the microtask queue is fully drained — so a
   non-serializing implementation would have pushed `'second'` before the assertion. The final
   `deepEqual(['first:start','first:end','second'])` also pins ordering, not just exclusion. Can
   genuinely fail. Note the failure *mode* if serialization broke in the "waiter starts too early"
   direction is a clean assertion failure; if it broke in the "waiter never starts" direction the
   `await Promise.all` would hang to the runner timeout — still a failure, just a slower one.
2. **Independence of keys** (`L26`): holds `/tmp/a` parked and *awaits* a `/tmp/b` holder to
   completion. If keys wrongly collided, this `await` would never resolve and the test fails by
   runner timeout rather than by assertion. That is a weaker failure signal than an assert but it
   is a real one, and there is no way to express "this promise resolves without the other" without
   either awaiting it or racing a timer.
3. **A failure surfaces and does not poison the key** (`L41`): `assert.rejects` with a message
   regex pins that the caller gets *its own* error (not a neighbour's, not a swallowed undefined),
   and the follow-up acquisition returning `'ran'` pins that the key still works afterwards. Both
   are awaited. Can fail.
4. **Path spellings collapse** (`L51`): `/tmp/a/.` vs `/tmp/a`. Asserts `order` is empty after a
   tick (so the waiter is genuinely blocked, i.e. the keys collided as intended) and then that both
   ran in order. Can fail — if `resolve` were dropped, the waiter would run during the tick and
   `deepEqual(order, [])` would fail.

Cross-test state: `chains` is module-global and `/tmp/a` is reused by tests 1, 2, 3 and 4. Every
test awaits all of its holders before returning (test 2 releases and awaits `held`; test 1 awaits
`Promise.all`), so each leaves the map empty and no test can inherit a held key. Node's test runner
runs top-level tests in a file sequentially by default, so this holds. If a test *did* leak a held
key, the next `/tmp/a` test would hang rather than silently pass — a loud failure, not a false
green.

Not covered (acceptable): re-entrant acquisition (would deadlock — no call site does it), the
absence of a timeout, and that the map is emptied after the last holder (white-box detail, and the
identity guard is exercised indirectly by tests 1 and 4 which enqueue a successor while a holder is
outstanding).

## Functions (low-level)

### `tick(): Promise<void>` (`L5`)

`new Promise(resolve => setImmediate(resolve))`. Yields one macrotask turn, which drains all
pending microtasks first. Used as "let everything that could have run, run". Correct instrument for
this module (no timers involved anywhere in `agent-locks.ts`, so no fake-timer coordination is
needed). Verdict: correct.

### Test `'withAgentLock serializes holders of the same checkout, in arrival order'` (`L7`)

`releaseFirst` is initialised to a no-op and reassigned inside the first holder's `fn`; because
`fn` runs in a microtask and the assertion is after `await tick()`, the reassignment has certainly
happened before `releaseFirst()` is called at `L21`. If it had not, the test would hang rather than
pass silently. Verdict: correct.

### Test `'different checkouts never contend'` (`L26`)

`release` likewise reassigned inside the parked holder; it is called at `L37`, after the awaited
`/tmp/b` holder, by which point the `/tmp/a` holder's `fn` has certainly started (it was enqueued
first and only needs a microtask). Verdict: correct.

### Test `'a failed holder surfaces its own error and does not poison the next one'` (`L41`)

`assert.rejects` is awaited (a missing `await` here is the classic silent-pass; it is present).
Verdict: correct.

### Test `'the key is the resolved path, so spellings of one checkout contend'` (`L51`)

Asserts the blocked state (`order` empty) *and* the released order. Verdict: correct.

## Bugs found

None found.
