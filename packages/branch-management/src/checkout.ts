import { nodeGitRunner, type GitRunner } from './git.js'
import { agentBranchName } from './branch-names.js'
import { addWorktree, attachWorktree, type AddedWorktree } from './worktree.js'
import { linkDependencies } from './worktree-deps.js'
import { reconcileBranchLinks } from './branch-links.js'

/**
 * A checkout as an agent gets it (#1725): the worktree, the parent's dependency trees linked in,
 * and the `branches/` links brought up to date — one sequence, whichever surface asks for it (the
 * daemon allocating a run, the command line).
 */

/** A new agent's checkout, on a fresh `tf-agent-<id>` branch from `base` or the project's head. */
export async function createCheckout(
  repo: string,
  opts: { agentId: string; base?: string },
  git: GitRunner = nodeGitRunner(),
): Promise<AddedWorktree> {
  const worktree = await addWorktree(repo, { agentId: opts.agentId, branch: agentBranchName(opts.agentId), ...(opts.base ? { base: opts.base } : {}) }, git)
  await settle(repo, worktree.path, git)
  return worktree
}

/** A continued agent's checkout, back on the branch its work is on. */
export async function attachCheckout(
  repo: string,
  opts: { agentId: string; branch: string },
  git: GitRunner = nodeGitRunner(),
): Promise<AddedWorktree> {
  const worktree = await attachWorktree(repo, opts, git)
  await settle(repo, worktree.path, git)
  return worktree
}

/**
 * What a checkout gets besides its files. Both are best-effort: `node_modules` is gitignored, so
 * a fresh checkout has none and a link that cannot be made is a worse run, not a failed one; a
 * link under `branches/` is a view, and the next reconcile pass makes it.
 */
async function settle(repo: string, path: string, git: GitRunner): Promise<void> {
  await linkDependencies(repo, path).catch(() => [])
  await reconcileBranchLinks(repo, { git }).catch(() => {})
}
