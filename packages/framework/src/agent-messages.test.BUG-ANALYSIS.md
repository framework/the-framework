# Bug analysis: packages/framework/src/agent-messages.test.ts

## Business logic (high-level)

Nine `node:test` cases over `AgentMessageQueue`, all synchronous in-memory work with no timers, no
fs and no fake clock — appropriate, since the queue is pure state plus promises. Each test builds
its own queue, so there is no shared-state coupling between cases.

Mapping to `agent-messages.test.SPEC.md`, and whether each test can actually fail:

- *"already waiting are delivered in the order they were sent"* → `L5`. Pushes two, awaits two,
  asserts both payloads in order. A FIFO→LIFO regression flips the assertion. Real.
- *"a message that arrives while the agent is waiting is handed straight over"* → `L13`. Calls
  `next()` without awaiting (parks), pushes, then awaits the stored promise. This is the one place
  where the direct hand-off path (`waiters.shift()` inside `push`) is exercised; if `push` queued
  instead of handing off, the awaited promise would never settle and the test fails by runner
  timeout rather than assertion — a weaker but genuine signal.
- *"closing the chat wakes a waiting agent with no message"* → `L20`. Same park-then-act shape,
  asserting `undefined`. Real.
- *"every later request also reports none"* → `L27` (`next()` on an already-closed queue). Real,
  but note what it does **not** cover: the queue is *empty* when closed. The combination "closed
  **with** something still pending" is only ever tested through `takeQueued` (`L65`), never through
  `next` — which is exactly the gap the ordering bug in `agent-messages.ts:74` lives in. So this
  suite passes green over a SPEC violation; that is a coverage hole in the test file, and the bug
  itself belongs to the source (recorded there).
- *"messages pushed after the chat is closed are ignored"* → `L33`. Real.
- *"stopping the agent ends the wait rather than hanging it"* → `L40`. Parks with a signal, aborts,
  asserts `undefined`. Exercises `onAbort`, including the splice out of `waiters` (indirectly — the
  splice is not observed, but if it were missing nothing in this file would notice; see below).
  Real.
- *"a message already in hand still wins over an in-flight stop and is not lost"* → `L48`. Aborts
  the controller **before** pushing and calling `next`, so it pins the shift-before-abort-check
  ordering as intended behaviour. Real, and it is the reason a fix for the source bug must key on
  `closed` rather than on `aborted`.
- *end-of-run drain* → `L57` and `L65`. `takeQueued()` returns the queued message then `undefined`;
  and returns `undefined` after `close()` even with a message pending ("pending or not"). Both are
  synchronous tests with no `async`/`await` needed — correctly declared as sync functions, so there
  is no forgotten-await hazard. Real.

Every asynchronous assertion in the file is awaited (`await q.next()`, `await pending`), so there is
no test that passes by not asserting. No test asserts on a rejected promise, and none needs
`assert.rejects` — the queue never rejects by design (it resolves `undefined` instead), which is
itself the property the suite pins.

Uncovered behaviours worth naming: FIFO among *multiple parked waiters* (two `next()` calls parked,
then two pushes) — the SPEC says "waiting agents are served in the order they started waiting" and
nothing here checks it; removal of the abort listener after a normal hand-off (a listener leak
would be invisible to this suite); and that an aborted waiter is spliced out so a later `push` is
not swallowed by a dead waiter. None of these are broken in the current implementation, so they are
missing coverage rather than bugs.

## Functions (low-level)

### `test('… drains already-queued messages in order (between turns)')` (`L5`)

Two pushes, two awaited `next()` calls, `deepEqual` on the message objects (so a change to
`ChatMessage`'s shape would surface here). Verdict: correct.

### `test('… hands a message to a parked waiter (stay-open)')` (`L13`)

`const pending = q.next()` is intentionally not awaited before `q.push('later')` — the whole point
is that the promise is outstanding. It *is* awaited at `L17`. Verdict: correct.

### `test('… close() wakes a parked waiter with undefined')` (`L20`)

Verdict: correct.

### `test('… next() resolves undefined once closed')` (`L27`)

Only covers the empty-queue case; see the coverage hole above. Verdict: correct (as far as it goes).

### `test('… push() is a no-op after close()')` (`L33`)

Closes first, then pushes, then asserts `next()` is `undefined`. Note this passes for two different
reasons (the push was dropped, *and* the queue is closed), so it does not isolate `push`'s guard —
but it cannot pass if the guard were removed, since `next` would then return the pushed message
(precisely because of the shift-before-closed ordering). So it does fail on the regression it
targets. Verdict: correct.

### `test('… next() unblocks on abort (Stop / budget cap)')` (`L40`)

Verdict: correct.

### `test('… next() returns a queued message even if the signal is aborted')` (`L48`)

Pins deliberate behaviour, with the comment stating the intent. Verdict: correct.

### `test('… takeQueued() drains without waiting — the end-of-run check (#1390)')` (`L57`)

Synchronous. Verdict: correct.

### `test('… takeQueued() is undefined once closed, pending or not (#1390)')` (`L65`)

The only test of the closed-with-pending state, and it goes through `takeQueued` only. Verdict:
correct.

## Bugs found

None found. (The suite's blind spot — `next()` on a closed queue that still has a message pending —
is where the source bug recorded in `agent-messages.BUG-ANALYSIS.md` hides; the fix belongs in
`agent-messages.ts`, and a regression test here would be `q.push('stale'); q.close(); assert.equal(await q.next(), undefined)`.)
