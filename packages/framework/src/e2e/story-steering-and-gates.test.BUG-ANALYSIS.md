# Bug analysis: packages/framework/src/e2e/story-steering-and-gates.test.ts

## Business logic (high-level)

Four stories covering everything a user does *to* a live session. Each follows the same path the
product does — browser → dashboard RPC → `control.jsonl` → the agent process — and reads the answer
back out of the agent's own event log, so nothing is asserted against an in-process stub.

**1. Answer a parked gate (L19-54).** The agent parks on a scripted `choices` gate. Asserted: the
full gate reaches the feed (options ≥ 2 and a recommendation, so a gate stripped of either fails);
the cross-project questions hub lists it against this agent with the *same* gate id and the same
option ids (`deepEqual` on the mapped ids, which would catch a hub that re-derived or re-ordered
them); answering it emits `choice-resolved` carrying both the picked option and `by: 'user'`; the
agent then runs to `done`; and the hub no longer lists it. That last assertion is the one that
proves resolution propagates back to the cross-project surface rather than only to the agent.

**2. Chat with a live agent (L56-95).** The message is sent *while the agent is parked*, which is
what makes the queueing provable: it cannot be drained until the gate resolves. The proof that it
became its own turn is a `driver`/`start` event whose prompt contains the message — i.e. the driver
was actually prompted with it, not merely that the message was logged. Then the story goes further
than the live feed: after teardown it reads the *archived* event log off disk
(`archivedAgentPaths`) and asserts the exchange survives the session (#1179), with the event log
itself as the record rather than a second prose re-narration.

**3. Re-arm the handoff mid-run (L97-126).** Unticking the box mid-run must both announce itself on
the feed (`handoff-armed` with neither `push` nor `pr`) *and* fold onto the meta a reloaded tab
reads back (`onAgents`). Both are waited for, then re-asserted explicitly — the double check is what
distinguishes "the event fired" from "the meta followed".

**4. Stop, reclaim, delete (L128-160).** Stopping a parked agent must end it `stopped`, not
`failed` (the user interrupted it). Then the E5 retention rule: the checkout is reclaimed even for a
stopped agent — asserted three ways (the worktree is gone, the Remove list is empty, and
`onAgentWorktree(...).own` is `false`) — while the session *row* survives. Finally `sendDeleteAgent`
removes the row itself, which is the destructive sibling of Stop.

**Do the tests verify what they claim?** Yes, and unusually well for E2E: each story asserts on a
surface *other* than the one it acted on (feed → hub, RPC → archived file on disk, event → meta,
stop → worktree state), so a change that updates only one side fails. Every wait is a named
`waitFor` with the harness's 30 s bound, and every world is closed in a `finally`.

**Idioms checked.** `if (gate.kind !== 'choice') return` at L31/L64/L105 is unreachable — `waitFor`'s
predicate already selected on `kind === 'choice'` — and exists only to narrow the union for
TypeScript; a `return` there would still run the `finally`, so even in the impossible case the world
is torn down (the test would silently pass, which is why story 1's explicit `assert.equal(gate.kind,
'choice')` before it is the better form). `tail.stop()` at L141 followed by `world.close()`'s own
stop is safe: both layers are flag-guarded/idempotent.

## Functions (low-level)

- **`test('answer a parked session’s question from the questions hub (#304/#1455)')`** — the
  `deepEqual` on option ids and the equality on `question.choice.id` are the assertions that make
  the hub reading non-trivial. `gate.recommended!` is safe because L33 asserted it is present.
  Verdict: correct.
- **`test('chat with a live session: a message becomes the next agent turn (#714)')`** — the
  `waitFor` predicate reaches three levels into the event (`kind === 'driver' && event.type ===
  'start' && prompt.includes(...)`), so it cannot be satisfied by the message merely being echoed
  elsewhere on the feed. The archive assertion names what it got on failure
  (`JSON.stringify(archived)`), which is the right diagnostic for a path-shaped failure. Verdict:
  correct.
- **`test('rearm the handoff mid-run; the meta a reloaded tab reads follows (#1102)')`** — waits on
  both the event and the meta, then asserts the meta's two booleans explicitly (a `waitFor` that
  returned the agent could otherwise leave the reader unsure what was checked). Verdict: correct.
- **`test('stop a session; its checkout is reclaimed once the work is on the remote, then deleted')`**
  — `end.stopped === true` distinguishes stopped from failed at the event level, and the status is
  re-checked at the meta level (`'stopped'`), so both records must agree. The delete assertion
  interpolates the RPC's error on failure. Verdict: correct.

## Bugs found

None found.
