# Bug analysis: packages/framework/src/e2e/story-session-lifecycle.test.ts

## Business logic (high-level)

Three stories covering what a user sees between clicking Start and reading the archived row, driven
through the dashboard's own RPCs with real spawned agent processes and real git.

**1. Start → live feed → archived row (L19-101).** The longest story, and the one that ties the most
surfaces together:

- *The live feed* is read through `tailAgent`, i.e. the same relocating journal tailer `onEvents`
  rides — so this also proves the tail survives teardown moving the journal into the archive
  (without that, the `end` event at L45 would be lost when the `fs.watch` signal is missed).
- *The session banner* is asserted to name the fake driver (`fake: true`, `driver: 'fake'`), which
  is how the story proves no real agent CLI ran.
- *The spawned spec* is read from the harness's argv recording, the only observable channel for a
  detached spawn, and pins that `handoff: 'local'` reached the child as one named rung rather than
  as a set of booleans, plus that the child was handed the same run id the RPC returned.
- *Ordering* is asserted structurally (`indexOf('session') < indexOf('end')`) rather than by array
  equality, which is the right level: it cannot break on an added event kind but still fails if the
  banner arrives after the end.
- *Usage* must have reached the feed with `inputTokens > 0` — a real assertion, since a driver that
  dropped usage would emit the event with zeros or not at all.
- *The retention rule* (E5) is checked from both sides: the checkout stays on the Remove list, and
  `git ls-remote --heads origin` proves nothing was published — a genuine end-to-end check against
  the fixture's real bare remote, not a stub.
- *The archive* is polled (not read once) because teardown commits it on the data branch, a full git
  cycle that a single read would race; and the handoff panel is asserted to see the agent branch as
  `exists && empty`, i.e. pure bookkeeping with nothing publishable.
- *Cross-project surfaces* (`onActivity`, `onRecentAgents`) must list the finished agent, including
  `activity.whole` naming the project as read whole (#1625).

**2. Two sessions concurrently (L103-158).** Both agents are parked on a scripted gate via
`withFakeAwait`, which is what makes "provably alive at the same time" true rather than merely
"both were started". It then checks: distinct ids, both rows `running`, distinct own worktrees under
the project's worktrees dir, and the runtime's `activeAgentSlots` naming both runs with a live state
and a numeric pid. Answering each gate lets each finish independently, and the story ends by waiting
for the slots to drain — with an explicit note that the meta flips `done` a beat before the daemon
reaps the child, so the wait is the honest way to express it.

**3. Publish a finished session (L160-197).** The push is fired the instant the row flips `done`,
deliberately inside teardown's window, against a push-armed run so teardown is a pusher too. That is
the #799 collision: both sides create the same ref, and whichever loses used to strand the worktree.
The assertions cover all three outcomes — the click succeeds, the branch is really on origin
(`ls-remote`, not a flag), and the worktree is still retired (`onRetainedWorktrees` empty) — so a
regression on either side of the lock fails a different assertion.

**Do the tests verify what they claim?** Yes. Every wait is a `waitFor` with a named failure, every
assertion is falsifiable, and the three stories deliberately overlap on the retention rule from
opposite directions (kept when publishing is refused, reclaimed when it is armed). The `try/finally`
around each world means a mid-story failure still tears down the spawned children.

**Race hazards considered and dismissed.** L39 reads `spawnedSpecs()` after the session event has
already been seen, so the child has certainly written its spec (the recording happens before
`runCli` in `fake-agent-bin.ts`). L52 calls `tail.stop()` and `close()` later stops it again;
`tailAgentEvents`' stop is flag-guarded and `followFile`'s is idempotent, so the double stop is
safe. L133's `.sort()` on arrays of arrays compares their default string forms, which is
deterministic and applied identically to both sides of the `deepEqual`.

## Functions (low-level)

- **`test('start a session, watch it live, and read the archived row when it ends')`** — analyzed
  above. The narrowing idiom `session.kind === 'session' && session.fake` is an expression that
  yields `false` (not `undefined`) if the kind were wrong, so `assert.equal(…, true)` fails loudly
  rather than passing vacuously. Same pattern for `end.ok`. Verdict: correct.
- **`test('two sessions run concurrently, each in its own worktree (#736)')`** — `withFakeAwait`
  wraps both Starts, so both children inherit the gate mode at spawn. The `for` loop answering each
  gate uses `as const` to keep the pair tuples typed; the `if (gate.kind !== 'choice') continue`
  after an `assert.equal(gate.kind, 'choice')` is unreachable, kept for narrowing. Verdict: correct.
- **`test('publish a finished session: push its branch from the handoff panel (#799)')`** — the
  failure message on L180 interpolates the RPC's own error, which is what makes a regression here
  diagnosable. `waitFor` on `handoff?.pushed` tolerates the panel's read lagging the push.
  Verdict: correct.

## Bugs found

None found.
