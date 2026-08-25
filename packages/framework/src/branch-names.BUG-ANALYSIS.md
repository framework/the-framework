# Bug analysis: packages/framework/src/branch-names.ts

## Business logic (high-level)

The one home for branch naming (`branch-names.SPEC.md`), kept node-free so browser-safe code can
import it: the `tf-` prefix (slash-free on purpose — a `/` never resolves as a cloud session's
revision, and slash-free names let each `branches/` dir be named as its branch), the legacy
`the-framework/` prefix (recognized, never minted), the `tf-data` data branch, birth-branch
minting from the agent id, the dir-name equality, the id-recovery inverse, and the two
classifiers (`isRunBranch`, `isWorktreeDirName`).

SPEC claims verified:

- **Minting** — `agentBranchName(id)` = `tf-agent-<id>`; `worktreeDirName === agentBranchName`
  (the #1580 equality). Agent ids are `isSafeAgentId`-shaped (`[A-Za-z0-9_-]+`) at every minting
  call site, so the produced names are valid refs and never contain `/`. ✓
- **Recovery** — `agentIdFromWorktreeDir` strips exactly `tf-agent-`; any other name returns
  as-is per the legacy-layout rule. Callers that could feed it non-checkout names guard with
  `isWorktreeDirName` first (`worktreeDirEntries` in agent-store.ts L799 additionally requires
  `isSafeAgentId` on the result, which excludes the `tf-data` sibling and any stray name;
  daemon-runtime.ts L608/L623 apply it to `basename(worktree)` of paths that come from the
  worktree lister, same shape). Reliance noted; consistent everywhere. ✓
- **Deletable set** — `isRunBranch`: excludes `tf-data` exactly, then any `tf-*` or legacy
  `the-framework/*`. This matches the SPEC's own definition, including its deliberate looseness:
  a session-named `tf-<name>` is indistinguishable from a user's own branch that happens to start
  with `tf-` — the SPEC claims the prefix wholesale ("Every framework-minted branch starts with
  `tf-`"), so this is the documented design, not a defect. Names *near* the data branch
  (`tf-database-x`) are correctly run branches; only the exact `tf-data` is protected, which is
  right since the data branch is one exact ref. ✓
- **Checkout classifier** — `isWorktreeDirName` accepts only the minted `tf-agent-` spelling, so
  rename links (`tf-<session>`), the `tf-data` checkout, and user entries in the same directory
  are all non-checkouts. Note `tf-agent-` with an *empty* remainder ("tf-agent-") would pass this
  but fail `isSafeAgentId('')` at the one consumer that derives ids — harmless. ✓

Cross-checks with consumers: `data-branch.ts` re-exports `DATA_BRANCH` and builds the checkout
path from it; `branch-links.ts` uses `isWorktreeDirName` for the provably-ours rule; sweeps use
`isRunBranch` as the only self-serve deletion gate, which combined with MEMORY.md's
"only remove what's on the remote" gives the two-key protection the SPEC describes.

## Functions (low-level)

- **`AGENT_BRANCH_PREFIX` / `LEGACY_AGENT_BRANCH_PREFIX` / `DATA_BRANCH`** — constants; the data
  branch shares the prefix by design and is carved out where it matters. Correct.
- **`agentBranchName(agentId)` / `legacyAgentBranchName(agentId)`** — template concatenation; no
  validation here, by contract the id is store-minted (path-safe). Correct.
- **`worktreeDirName(agentId)`** — alias of the branch name; keeping it a separate export
  preserves the semantic seam if the equality ever broke. Correct.
- **`agentIdFromWorktreeDir(name)`** — prefix strip with legacy pass-through; total function, no
  throw. Correct (with the caller-side guard reliance noted above).
- **`isRunBranch(name)`** — exact `tf-data` carve-out before the prefix tests; order matters and
  is right. Correct.
- **`isWorktreeDirName(name)`** — starts-with on the full minted spelling. Correct.

## Bugs found

None found.
