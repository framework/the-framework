# Bug analysis: packages/framework/src/store/index.ts

## Business logic (high-level)

The store package's barrel: re-exports the agent record (`agent-store.js`), the checkout
resolution (`agent-checkout.js`), the worktree lifecycle (`worktree.js`, which itself re-exports
the branch-name helpers), and the dependency linking (`worktree-deps.js`). `index.SPEC.md` says it
has no business logic of its own, and it does not: no values are computed, renamed, or filtered
here beyond selection.

Checked:

- Every name exported here exists in its source module with the same spelling and kind
  (value vs `type`): `AgentStore`, `nodeStoreFs`, `applyEventToMeta`, `listAgents`,
  `readAllAgents`, `findAgent`, `readEventLog`, `isPidAlive`, `readLiveMeta`,
  `reconcileOrphanedAgents`, `loadAgentEvents`, `readLiveMetas`, `archiveWorktreeAgent`,
  `archivedAgentPaths`, `patchArchivedAgent`, `ArchivePatch`, `restoreArchivedAgent`,
  `listWorktreeDirs`, `worktreeDirEntries`, `WorktreeDirEntry`, `agentIdFromStartedAt`,
  `startedAtFromAgentId`, `isSafeAgentId`, the five path constants, `StoreFs`, `AgentMeta`,
  `LiveAgent`, `AgentStatus`, `OpenStoreOptions` (agent-store); `resolveAgentCheckout`,
  `resolveAgentEventsPath` (agent-checkout); the worktree lifecycle set including the
  branch-name re-exports `agentBranchName`, `legacyAgentBranchName`, `AGENT_BRANCH_PREFIX`,
  `LEGACY_AGENT_BRANCH_PREFIX` (worktree); `linkDependencies`, `findDependencyDirs`,
  `nodeLinkFs`, `LinkFs` (worktree-deps).
- Consumers across the package import these names from `./store/index.js` (worktrees.ts,
  daemon-runtime.ts, cli.ts, dashboard/agent-handoff.ts, branch-links.ts, archived-agent-patch.ts,
  dashboard-rpc/*), and none imports a name the barrel misses.
- Types-only entries use `type` correctly, so the barrel adds no runtime edges beyond the four
  modules themselves; the node-import discipline (browser-safe callers use `branch-names.js`
  directly, not this barrel) is a property of the *importers*, enforced elsewhere by
  client.test.ts, and nothing here undermines it.

## Functions (low-level)

No functions. Notable entries only:

- `readAllAgents as readAllAgents`, `readLiveMetas as readLiveMetas`,
  `startedAtFromAgentId as startedAtFromAgentId`, `LiveAgent as LiveAgent` — self-renaming
  aliases, residue of earlier renamed exports. Pure style noise; behavior identical to a plain
  re-export. Not a bug.
- The worktree block re-exports `AGENT_BRANCH_PREFIX`/`agentBranchName`/legacy twins that
  `worktree.ts` forwards from `branch-names.ts` — one extra hop, same values. Correct.

## Bugs found

None found.
