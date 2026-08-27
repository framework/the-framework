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
 * The directory an agent's worktree lives in under `.the-framework/branches/` (#1580): the run
 * branch's own name, so the flat `branches/` listing reads as branch names. #1581 (slash-free
 * names) is what makes this equality possible at all.
 */
export function worktreeDirName(agentId: string): string {
  return agentBranchName(agentId)
}

/** The inverse of {@link worktreeDirName}: the agent id a checkout directory's name carries. */
export function agentIdFromWorktreeDir(name: string): string {
  return name.slice(`${AGENT_BRANCH_PREFIX}agent-`.length)
}

/**
 * Whether a branch is one the framework minted for a run (#1650): the run-id spelling or a
 * session-named `tf-<name>` — and never the data branch, which shares the prefix. The only
 * branches the framework may delete on its own.
 */
export function isRunBranch(name: string): boolean {
  return name !== DATA_BRANCH && name.startsWith(AGENT_BRANCH_PREFIX)
}

/**
 * The session name a branch carries (#1725): `tf-<session name>` minus the prefix. The name is
 * read off the branch and never recorded beside it — a checkout has one branch, and that branch
 * is the name. Undefined while the agent has not named its session (the birth spelling
 * `tf-agent-<agent id>` is not a name) and for every branch The Framework did not mint.
 */
export function sessionNameOf(branch: string | undefined): string | undefined {
  if (!branch || !isRunBranch(branch) || isWorktreeDirName(branch)) return undefined
  return branch.slice(AGENT_BRANCH_PREFIX.length)
}

/**
 * Whether a name under `branches/` is a framework checkout directory. The same directory also
 * holds the rename links (#1589) and possibly a user's own entries, and only names the framework
 * mints — the run branch spelling — are checkouts.
 */
export function isWorktreeDirName(name: string): boolean {
  return name.startsWith(`${AGENT_BRANCH_PREFIX}agent-`)
}
