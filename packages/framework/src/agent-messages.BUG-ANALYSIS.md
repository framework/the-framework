# Bug analysis: packages/framework/src/agent-messages.ts

## Business logic (high-level)

The live-chat channel (#714): the user's own turns into a *running* agent, the mirror image of an
await gate. Two consumers exist, and the split matters:

- `next(signal?)` — the **stay-open park**. Used by `await-gate.ts:183` only when
  `runChatPhase(..., stayOpen = true)`, i.e. an agent with its own terminal dashboard
  (`cli.ts:942` sets `stayOpenChat` when `opts.agentId === undefined`). It returns a queued message
  immediately, otherwise parks until one arrives or the wait should end.
- `takeQueued()` — the **end-of-run drain** (#1390). Used by `await-gate.ts:187` for
  daemon-spawned sessions, which must never idle: a queued follow-up becomes the next turn, an
  empty queue ends the session, and a later message reopens it via `--resume`.

Producer side: the control-channel watcher calls `push(text)`; `cli.ts:796` calls `close()` from
the run controller's `abort` listener, so Stop and the budget cap both close the chat.

Invariants from `agent-messages.SPEC.md`:

1. *Delivered in order, never dropped*: messages hand over FIFO, and parked waiters are served FIFO.
2. *A settled agent ends rather than idling*: `takeQueued` never waits.
3. *Stopping always ends the wait cleanly*: a stop/close wakes every parked waiter with `undefined`,
   "further messages are ignored **and no already-queued message can start another turn**".
4. *Only agents someone can talk to get a chat*: enforced by the caller (a headless agent gets no
   `AgentMessages` at all), not by this file.

Structural invariant that makes the two-collection design safe: `pending` and `waiters` are never
both non-empty. `next` only parks when `pending` is empty, and `push` hands to a waiter instead of
queueing whenever one is parked. So FIFO cannot be violated by a message overtaking a parked waiter
(invariant 1 holds), and no message can sit behind a waiter forever.

Where the design does *not* hold up is invariant 3. `close()` sets `closed` and drains `waiters`,
but deliberately leaves `pending` populated; `takeQueued()` guards on `closed` **before** touching
`pending`, while `next()` shifts `pending` **before** its `closed` check. The two consumers
therefore disagree about a stopped agent with a queued message — and `await-gate.ts` adds a second
guard (`deps.signal?.aborted ? undefined : messages.takeQueued()`) on the `takeQueued` path only,
so the stay-open path has neither belt nor braces. See "Bugs found".

Listener hygiene (a real leak risk in code shaped like this, and handled correctly here): the
`abort` listener is registered only on the parking path, is registered `{ once: true }`, and is
removed by `waiter()` on every non-abort resolution (`push` hand-off and `close`). The early
returns (queued message / closed / already-aborted) register nothing. A long agent run that takes
thousands of messages therefore does not accumulate listeners on the run controller's signal.

The `onAbort` path splices the waiter out of `waiters` by identity before resolving, so a later
`push` cannot hand a message to a dead waiter and drop it — an important detail, since `waiters` is
otherwise only consumed by `shift()`.

Stale doc, not a bug: the `ChatMessage` comment says "plus the surface it arrived through (#917)"
but the interface carries only `text`.

## Functions (low-level)

### `interface ChatMessage` / `interface AgentMessages`

Types only. `AgentMessages` is what `cli.ts:939-940` implements as an adapter (wrapping `next` in
`gateKeepalive.hold`), so the interface — not the class — is the contract `await-gate` codes to.
The JSDoc on `next` promises "`undefined` when … the source was closed", which the implementation
does not honour when a message is queued (see bug 1).

### `AgentMessageQueue.push(text: string): void` (`L53`)

Wraps `text` in a `ChatMessage`, hands it to the oldest parked waiter or queues it. `closed` →
no-op, matching "further messages are ignored". Empty string is a legitimate message and is passed
through (`next` tests `queued !== undefined`, not truthiness, so an empty-text message is not
mistaken for "nothing queued" — correct). No unbounded-growth guard: a user spamming the chat while
the agent is busy grows `pending` without limit, but the producer is a human typing into a
dashboard, so this is not a reachable failure mode. Verdict: correct.

### `AgentMessageQueue.close(): void` (`L62`)

Sets `closed`, then drains `waiters` with `undefined` in a `while (shift())` loop. Each `waiter()`
removes its own abort listener, so closing also cleans up listeners. Idempotent (a second call
finds an empty `waiters`). Deliberately does not clear `pending` — which is what bug 1 turns on.
Verdict: bug found (in combination with `next`).

### `AgentMessageQueue.takeQueued(): ChatMessage | undefined` (`L68`)

Closed → `undefined` regardless of what is queued (the "pending or not" behaviour the test at
`agent-messages.test.ts:65` pins). Otherwise shifts one message, or `undefined`. Never waits, never
touches `waiters` — correct, since the two collections are never both non-empty. Verdict: correct.

### `AgentMessageQueue.next(signal?: AbortSignal): Promise<ChatMessage | undefined>` (`L73`)

Order of checks: `pending.shift()` → `closed || signal?.aborted` → park.

- *Queued + not closed*: returns it. Correct (drain between turns).
- *Queued + aborted signal, not closed*: returns it. Deliberate and tested (`test` at `L48`, "a
  message already in hand … is not lost").
- *Queued + closed*: returns it. Contradicts the SPEC (bug 1).
- *Empty + closed/aborted*: `undefined` without parking or registering a listener. Correct.
- *Empty + live*: parks. `onAbort` is referenced inside `waiter` before its `const` declaration —
  legal, since `waiter` cannot run before the constructor callback finishes (TDZ is resolved by
  then). The listener is added *after* `waiters.push(waiter)`; if the signal were already aborted
  the `addEventListener('abort', …, { once: true })` would fire synchronously — but that case
  returned earlier, so no re-entrancy. Correct.
- *Double resolve*: impossible in effect — `onAbort` splices the waiter out before resolving, and
  `waiter` removes the abort listener before resolving; even if both ran, `resolve` is idempotent.

Verdict: bug found (the closed + queued ordering).

## Bugs found

1. `L74-76` (`next`): a message queued **before** the chat was closed is still handed out **after**
   it is closed, so a stopped agent starts one more turn off a stale message. `next()` shifts
   `pending` before it tests `this.closed`. Scenario: a local agent with its own terminal dashboard
   (`cli.ts:942` → `stayOpenChat: true` → `await-gate.ts:183`) is mid-turn; the user types a chat
   message, which queues because no waiter is parked; the user then presses Stop (or the budget cap
   fires) — `cli.ts:796` calls `messages.close()`, and the loop comes back round, emits `settled`
   and calls `messages.next(deps.signal)`, which returns the queued message; `runChatPhase` then
   calls `session.prompt(...)` on a stopped agent (either running an extra turn after Stop, or
   throwing out of the chat phase because the signal is already aborted, instead of returning the
   clean `stopped` result). This contradicts `agent-messages.SPEC.md` ("After the chat is closed,
   further messages are ignored and no already-queued message can start another turn") and the
   method's own JSDoc ("Resolves `undefined` when … the source was closed"); `takeQueued` already
   implements the rule, and `await-gate.ts:187` even double-guards that path with
   `deps.signal?.aborted`, so the stay-open path is the odd one out. Severity: major. Fix sketch:
   hoist the closed test to the top of `next` — `if (this.closed) return Promise.resolve(undefined)`
   before `this.pending.shift()` — which leaves the deliberate "queued beats a merely-aborted
   signal" case (tested at `agent-messages.test.ts:48`) intact.
