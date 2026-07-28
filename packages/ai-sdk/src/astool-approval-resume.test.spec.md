Tests for `Agent.resumeAsTool` (in `agent.ts`) on approval-pause snapshots — covers approve/reject paths, pause-again, cross-kind transitions, and contract violations.

## TLDR

- Approve path executes the gated tool exactly once and completes; the atomic `consume()` makes a second resume on the same id throw.
- Reject path completes WITHOUT executing the gated tool.
- Pause-again: an approved resume that hits another gated call returns `paused` with `pauseKind: 'approval'`, a fresh `subRunId`, and a stored snapshot whose `stepsSoFar` accumulates across suspends.
- Cross-kind: an approval snapshot can resume into a client-tool pause (`pauseKind: 'client_tool'`).
- Contract errors: `clientToolResults` on an approval snapshot, neither approved nor rejected ids supplied, and approved ids not in the pending set all reject with specific messages.
