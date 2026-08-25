# Bug analysis: packages/framework/src/dashboard/open-questions.test.ts

## Business logic (high-level)

Pins the pooled-questions projection: the full gate travels (options + recommended); resolved gates are closed and re-fired ones re-open; the log is read from the agent's own worktree (asserted via a `readFrom` capture); non-running, non-parked, and already-resolved agents contribute nothing; longest-waiting-first ordering; unreadable projects/logs degrade to an empty list; and the #1554 bridge behaviors — a web agent's question arrives from the bridge with label-ids, multi flag, default/detail preserved, waiting time counted from `receivedAt`; the archive join (not the live reader) finds the finished web run; two checkouts sharing one archive yield one card; an orphan bridged question is dropped; and the archive is read only when something is bridged (read-counter assertion).

The tests match the test SPEC. All paths go through injected deps, so the real store/readers are untouched — appropriate.

## Functions (low-level)

- **`liveAgent(overrides)` / `CHOICE`** — representative fixtures; `pendingChoice.id` matches the event id. Correct.
- **Test "openChoiceRequest keeps the whole request"** — `deepEqual` against the kind-stripped event. Correct.
- **Test "a resolved gate is closed, and a re-fired one is open again"** — both directions asserted. Correct.
- **Test "a parked run yields its question… read from the run own checkout"** — asserts `readFrom` is the worktree path and the full card shape including `updatedAt` from the meta. Correct.
- **Test "not-running, not-parked, and already-resolved runs contribute nothing"** — three agents, one events log carrying choice+resolved; expects `[]`. Note all three agents share the same injected log, which is fine since each disqualifies on its own criterion. Correct.
- **Test "longest-waiting first"** — two runs, expects `['stale', 'fresh']`. Correct (ascending ISO order).
- **Test "an unreadable project or log contributes nothing"** — `/two` throws on `liveAgents`, and `/one`'s `events` throws → gate can't be verified open → no card; expects `[]`. Correct.
- **Bridge tests (#1554)** — full-card `deepEqual` including `choice.id: 'bridge:session_01Web'` and label-ids; the one-card-per-question test asserts `['p1']`; the orphan test also asserts the lazy-archive counter (1 read with a bridged orphan, none when nothing is bridged). Correct.

Coverage note (not a bug): the last test's *title* claims "…or already has an answer on its way, is not offered", but no assertion covers the pending-answer filter — that lives in the default `bridged` dep (`unansweredBridgeQuestions`), which every test replaces with an injected stub. The behavior is unpinned; the test SPEC itself does not claim it, so this is a mildly over-claiming title, not a wrong assertion.

## Bugs found

None found.
