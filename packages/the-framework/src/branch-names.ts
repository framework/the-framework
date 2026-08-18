/**
 * Branch naming (#736/#1581), alone in a module so browser-safe code (the client barrel reaches
 * auto-pm's policy functions) can name branches without dragging the store's node imports along.
 */

/**
 * What every framework-minted branch is named under (#1581). Slash-free on purpose: a `/` in a
 * ref name never resolves as a cloud session's revision (anthropics/claude-code#87235), and it
 * keeps the planned flat `branches/` dir (#1580) possible, where each dir is named as its branch.
 */
export const AGENT_BRANCH_PREFIX = 'tf-'

/**
 * The pre-#1581 spelling. Never minted anymore, but branches under it still exist on remotes and
 * in archives, so classifiers and sweeps keep recognizing it until those die out.
 */
export const LEGACY_AGENT_BRANCH_PREFIX = 'the-framework/'

/**
 * The branch a framework-allocated worktree starts on (#736). The agent id exists
 * before the session name does, so the branch is created from the id and renamed
 * once the agent picks a name.
 */
export function agentBranchName(agentId: string): string {
  return `${AGENT_BRANCH_PREFIX}agent-${agentId}`
}

/**
 * The pre-#1581 run-branch spelling, kept only for reasoning about runs and refs that predate the
 * rename (archive branch guesses, remote scratch sweeps). Never used to create anything.
 */
export function legacyAgentBranchName(agentId: string): string {
  return `${LEGACY_AGENT_BRANCH_PREFIX}agent-${agentId}`
}

/**
 * The directory an agent's worktree lives in under `.the-framework/branches/` (#1580): the run
 * branch's own name, so the flat `branches/` listing reads as branch names. #1581 (slash-free
 * names) is what makes this equality possible at all.
 */
export function worktreeDirName(agentId: string): string {
  return agentBranchName(agentId)
}

/**
 * The inverse of {@link worktreeDirName}. A name without the run prefix is a pre-#1580 worktree
 * directory, which was the bare agent id — returned as-is so legacy checkouts stay addressable.
 */
export function agentIdFromWorktreeDir(name: string): string {
  const prefix = `${AGENT_BRANCH_PREFIX}agent-`
  return name.startsWith(prefix) ? name.slice(prefix.length) : name
}
