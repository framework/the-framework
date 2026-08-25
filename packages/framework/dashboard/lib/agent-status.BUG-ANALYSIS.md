# Bug analysis: packages/framework/dashboard/lib/agent-status.ts

## Business logic (high-level)

The single ranked status pill (agent-status.SPEC.md): failed > stopped > publishing… > ready for
merge > building… (only while live) > finished, or null while there is nothing to say. Built on
`agentProgress` (src/agent-view.ts: folds session-name + ready-for-merge over the whole feed) and
live-state's segment-aware `agentOutcome` / `isAgentActive` / `isPublishing` (current segment
only, so a resume rebuilds/re-publishes — pinned by the #762/#1450 tests).

Ranking audit against the SPEC:

- Ending outranks the way: failed and stopped are checked before publishing/ready — matches.
- Publishing outranks ready-for-merge and settles to ready-for-merge after the handoff reports —
  matches (test L44-49).
- building… only while `isAgentActive` (current segment has events and no `end`) — matches.
- The failure label carries `outcome.detail` when present — matches.

The silence gate is where code and intent part ways. The gate (L25) returns null when
`!progress.sessionName && !progress.readyForMerge && !failed && !stopped`. Its own comment says
silence is for an agent that has not "named itself, reached a state, **or ended**", and the SPEC
says the same ("not named its session, not signalled ready for merge and **not ended**"). But a
*clean* end (`outcome.ok === true`) sets neither `failed` nor `stopped`, so an agent that ended
cleanly without ever naming itself gets **no pill at all** — not "finished", and not
"publishing…" even when `isPublishing` is true (the gate sits above that check). Reachable: a run
whose model skips the session protocol (MEMORY.md singles out Haiku as skipping the
session-finish protocol; a model can equally never call set-session-name) and exits 0, or any
driver run that ends before naming. Bug 1.

## Functions (low-level)

- `agentStatusPill(events)` — pure fold via the three helpers; returns tailwind class fragments +
  label. Edge cases: empty feed → null (test-pinned); detail-less failure → "failed"; resumed
  feeds re-open building/publishing windows (delegated to the segment helpers, test-pinned).
  Verdict: bug found (silence gate, below); otherwise correct.

## Bugs found

1. `L25`: **A cleanly-ended agent that never named its session shows no status pill at all** —
   the gate omits the clean-end case although both its own comment ("…or ended") and
   agent-status.SPEC.md ("…and not ended") count ending as something to say. Scenario: an agent
   run ends `ok` without a `session-name` event (model skipped the protocol — e.g. Haiku — or
   exited before naming): the row shows no pill instead of "finished"; worse, with a handoff
   armed, the "publishing…" window is also suppressed while the epilogue pushes. Contradicts the
   SPEC and the comment; the sibling tests never cover an unnamed ended agent (every case
   includes `named`). Severity: minor. Fix sketch: include the outcome in the gate —
   `if (!progress.sessionName && !progress.readyForMerge && outcome === undefined) return null`
   (failed/stopped are subsumed by `outcome !== undefined`).

