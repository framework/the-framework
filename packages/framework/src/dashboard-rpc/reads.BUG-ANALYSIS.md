# Bug analysis: packages/framework/src/dashboard-rpc/reads.ts

## Business logic (high-level)

The read model behind the dashboard: every `POST /_rpc/<name>` read the browser makes. Invariants
(per `reads.SPEC.md`): a read never errors at the user (unknown project / failed read → that read's
empty result); agent-scoped reads are answered by whoever owns the agent (local checkout, or the
device over `relayOr`); the agent list merges archived + live + relayed stubs with one row per id;
records are annotated on the way out with what only the daemon knows (`cloudWaiting`, `otherHost`);
file reads are decided by the server's own git status; the handoff is branch-addressed; run-scoped
PR reads are since-filtered; cross-project rollups report which projects were read whole; the bridge
is read by cloud-session id.

Checks made:

- **Never-fails invariant**: `withProject`/`withAgentPath` catch the reader; `resolveProjectPath`
  cannot reject (`defaultProjectsProvider.resolvePath` catches its registry read internally), so the
  un-caught `await resolveProjectPath(...)` before the catch is safe. `onSystemPromptUser`
  (`loadUserSystemPrompt`) and `onGithubUrl` (`githubUrlFor`) have no local catch but both callees
  swallow all errors internally — verified. `onBridge*` reads are in-memory and cannot throw.
- **Relay coverage**: every relayed name here (`onAgentWorktree`, `onAgent`, `onProjectFiles`,
  `onProjectFileStatus`, `onFileDiff`, `onAgentChanges`, `onFileContent`, `onGitStatus`,
  `onAgentHandoff`) is on the device-side whitelist in `relay-dispatch.ts`, and all take
  `projectId` first, matching the arg[0]-replacement contract.
- **Path safety**: `onFileDiff` derives the status from the server's own `readFileStatuses` rather
  than trusting the caller, per spec. `onAgentWorktree`/`onAgentHandoff` guard `isSafeAgentId`
  before the id can reach a path; the other agent-scoped reads delegate to
  `resolveAgentCheckout`, which returns the project root for an unsafe id (no traversal).
- **Session-id regexes** on the bridge reads match `bridge-endpoints.ts`'s `SESSION_ID` exactly.
- **Ordering**: `onAgents` returns `[...remote, ...local]` where `local` is live-then-archived
  (each id-desc). The merged list is not globally re-sorted, so an archived run whose start is
  newer than a live run's, or a local run newer than a remote stub, can appear out of order. The
  doc comment claims "most-recent first"; the SPEC promises only the membership/dedup rules and
  the client (`App.tsx`) only does `find(status === 'running')`, so this is a cosmetic doc/order
  mismatch, not a functional bug — noted, not reported.
- **Annotations**: `forDashboard` is applied to local rows in `onAgents` and to
  `onRecentAgents` rows (as the SPEC requires), but not to relayed stubs — defensible since the
  relayed agent's bridge (if any) lives on the device, and its remoteness is already visible.
- The stale phrase in `onProjectFiles`'s doc ("Localhost-only by nature — the relay has no
  checkout, so it resolves `[]`") predates the device relay that the very same line now performs;
  doc drift only.

## Functions (low-level)

- `withProject(projectId, read, empty)` — resolve + forgiving read. Unknown project or rejecting
  reader → `empty`. Correct.
- `withAgentPath` — same over `resolveAgentPath` (live worktree → retained worktree → project
  root). Correct.
- `withProjects(build)` — registry-list rollup, `catch(() => [])` on the list. Correct.
- `onAgents` — remote stubs read synchronously up front (the comment explains the historical
  request-context hazard), then `readAllAgents` mapped through `forDashboard`; remote wins an id
  tie. Correct per SPEC; ordering nit noted above.
- `markCloudWaiting` — only `target === 'web'` with a `sessionId` the bridge store holds a
  question for gets `cloudWaiting: true`; new object, no mutation. Correct.
- `markOtherHost` — `host` undefined or equal to `hostname()` passes through; otherwise flagged.
  Correct (matches tests).
- `forDashboard` — composition of the two marks. Correct.
- `onRetainedWorktrees` — `listProjectWorktrees(cwd, { sizes: false })`, non-live rows only.
  Correct: live worktrees are excluded, failures → `[]`.
- `onAgentWorktree` — relayed or local. Local: root + `isSafeAgentId` guard, `own = path !== root`,
  since-filtered `readGitStatus`, size only for `own && !running` (spec: never `du` a live tree),
  PR from the worktree status when `own`, else from the agent's recorded PR via `resolveAgentPr`.
  Two `readLiveMetas` reads (one inside `resolveAgentPath`) could disagree across a teardown, but
  the worst case is a size read on a tree being removed → `worktreeSize` catches → `undefined`.
  Correct.
- `onAgent` — archived event log, `[]` fallback. Correct.
- `onDocs`/`onTickets`/`onTicket`/`onTicketsMeta`/`onAllTickets`/`onQueue`/`onOverview`/
  `onHotTickets`/`onDashboard` — thin `withProject(s)` wrappers; empties match declared types.
  Correct.
- `onRecentAgents` — rollup then `forDashboard` per row. Correct.
- `onInterventions`/`onActivity` — `ProjectionRead` passthrough preserving `whole`. Correct.
- `onProjectFiles`/`onProjectFileStatus` — relayed or `withAgentPath` over `crawlRepoFiles`/
  `readFileStatuses` (both swallow errors). Correct.
- `onFileDiff` — status decided server-side; unknown/unchanged path → null; readFileDiff guarded.
  Correct.
- `onAgentChanges` — statuses + `readFileChanges`, both guarded. Correct.
- `onFileContent` — delegates path safety to `readFileContent` (`safeRepoPath`). Correct.
- `onGithubUrl` — `githubUrlFor` swallows internally. Correct.
- `onGitStatus` — since-filtered when `agentId` given. For an ended agent whose worktree is gone
  this reads the project root's branch (documented limitation; `onAgentHandoff` is the honest
  read there). Correct as specified.
- `onAgentHandoff` — branch-addressed read from the project root; `checkout` passed only when it
  is genuinely the agent's own (`checkout !== cwd`), so the user's dirt is never reported as the
  agent's. `since: agent.startedAt`. Note: the PR inside is the branch-history pick, not the
  recorded `agent.pr`; display-side effect of the `first`-order issue recorded against
  `agent-handoff.ts` (see that file's analysis). Correct at this layer.
- `onSystemPromptUser` — callee swallows. Correct.
- `onBridgeQuestion`/`onBridgeAnswer`/`onBridgeEvents` — strict session-id validation, in-memory
  store reads, null/`[]` for anything unrecognised. Correct.
- `onBridgeStatus` — lastContact/questions/page/version snapshot. Correct.
- `onBridgeToken` — only when `preferences.bridge === true`; failed preference read counts as
  off. Correct per spec's "a daemon with the feature off never hands the secret out".

## Bugs found

None found in this file. (The `first`-vs-`latest` PR-pick issue that surfaces through
`onAgentHandoff`'s panel belongs to `packages/framework/src/dashboard/agent-handoff.ts` and is
reported there.)
