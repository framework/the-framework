# Bug analysis: packages/framework/dashboard/rpc/reads.ts

## Business logic (high-level)

Typed client stubs for every non-stream read. Name fidelity — the file's one failure mode — was
verified against `src/dashboard-rpc/index.ts` line 5 (the re-export list is the server's own
export set from `reads.ts`): onAgents, onAgent, onDocs, onQueue, onOverview, onRecentAgents,
onHotTickets, onInterventions, onOpenQuestions, onActivity, onDashboard, onGithubUrl,
onGitStatus, onProjectFiles, onProjectFileStatus, onFileDiff, onAgentChanges, onFileContent,
onTickets, onTicket, onTicketsMeta, onAllTickets, onRetainedWorktrees, onAgentWorktree,
onAgentHandoff, onSystemPromptUser, onBridgeQuestion, onBridgeStatus, onBridgeToken,
onBridgeAnswer, onBridgeEvents — all 31 present on both sides under identical names; neither
side has an entry the other lacks. Each stub's generic pins the client to the implementation's
parameter/return types, so a server-side rename or reshape fails the dashboard typecheck
(`tsc -p dashboard/tsconfig.json` in the `typecheck` script) rather than 404ing at runtime.

`export type *` re-export is type-only; nothing from `node:*` can leak into the bundle through
this module.

## Functions (low-level)

- 31 `rpc(...)` consts — mechanical stubs; nothing per-function beyond the name/type pinning
  described above. Verdict for each: correct.

## Bugs found

None found.
