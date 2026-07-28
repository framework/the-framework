Tests for the `asTool` suspend path (in `agent.ts`) when a sub-agent hits an approval-gated server tool — covers parent halt, snapshot persistence, and streamed updates.

## TLDR

- Parent stream halts with `finishReason: 'tool_approval_required'` and surfaces `pendingApprovalToolCall` when the inner agent's `needsApproval` tool is called.
- Snapshot is stored with `pauseKind: 'approval'`, the pending id, the `pendingApprovalToolCall` payload, and a message history starting with the user prompt.
- Both `agent_pending_approval` (informational) and `subagent_paused_approval` (suspend boundary, carrying `subRunId`) arrive as `tool-update` chunks; the snapshot round-trips through the run store.
