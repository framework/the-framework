/**
 * The naming rules for everything The Framework mints in git (#736/#1581), and the layout they
 * imply on disk. Pure: no node imports, so browser-safe code can name branches too.
 */

/**
 * The directory, under a project's root, that holds The Framework's state (#313): the agent
 * checkouts, and inside each checkout the agent's own record.
 */
export const FRAMEWORK_DIR = '.the-framework'

/**
 * Per-agent checkouts live under `<repo>/.the-framework/branches/` (#736/#1580), each in a dir
 * named as its branch. Kept out of git by the install-time `.the-framework/.gitignore`, so a
 * checkout never shows up as dirty in the parent.
 */
export const BRANCHES_DIR = 'branches'

/** An agent id is path-safe: no separators or traversal, only our own charset. */
export function isSafeAgentId(id: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(id)
}

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
 * The branch holding everything The Framework writes (#1582) — tickets, queue, session archives —
 * checked out under `.the-framework/branches/` in a dir named as itself, like every checkout
 * there. Named here beside the other branch names so the store can build its paths without
 * importing the data-branch module (which imports the store).
 */
export const DATA_BRANCH = 'tf-data'

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

/**
 * Whether a branch is one the framework minted for a run (#1650): the run-id spelling, a
 * session-named `tf-<name>`, or the legacy slashed form — and never the data branch, which
 * shares the prefix. The only branches the framework may delete on its own.
 */
export function isRunBranch(name: string): boolean {
  if (name === DATA_BRANCH) return false
  return name.startsWith(AGENT_BRANCH_PREFIX) || name.startsWith(LEGACY_AGENT_BRANCH_PREFIX)
}

/**
 * Whether a name under `branches/` is a framework checkout directory. The same directory also
 * holds the rename links (#1589) and possibly a user's own entries, and only names the framework
 * mints — the run branch spelling — are checkouts.
 */
export function isWorktreeDirName(name: string): boolean {
  return name.startsWith(`${AGENT_BRANCH_PREFIX}agent-`)
}
