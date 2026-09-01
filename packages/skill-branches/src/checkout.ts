import { nodeGitRunner, type GitRunner, BRANCHES_DIR, excludeFromGit } from '@gemstack/agent-data'
import { agentBranchName } from './branch-names.js'
import { addWorktree, attachWorktree, type AddedWorktree } from './worktree.js'
import { linkDependencies } from './worktree-deps.js'
import { reconcileBranchLinks } from './branch-links.js'
import { linkSkill, type SkillLink } from './skill-links.js'

/**
 * A checkout as an agent gets it (#1725): the worktree, `.branches/` hidden from git, the parent's
 * dependency trees linked in, the skill linked in where the agent's harness looks for it (#1739),
 * and the `.branches/` links brought up to date — one sequence, whichever surface asks for it (a
 * daemon allocating a run, the command line).
 */

/**
 * Other skills to link into the checkout beside this package's own. TEMPORARY (#1748): see
 * `SkillLink` — gone once skills are committed into the repository.
 */
export interface CheckoutSkills {
  skills?: readonly SkillLink[]
}

/** A new agent's checkout, on a fresh `agent-<id>` branch from `base` or the project's head. */
export async function createCheckout(
  repo: string,
  opts: { agentId: string; base?: string } & CheckoutSkills,
  git: GitRunner = nodeGitRunner(),
): Promise<AddedWorktree> {
  const worktree = await addWorktree(repo, { agentId: opts.agentId, branch: agentBranchName(opts.agentId), ...(opts.base ? { base: opts.base } : {}) }, git)
  await settle(repo, worktree.path, git, opts.skills)
  return worktree
}

/** A continued agent's checkout, back on the branch its work is on. */
export async function attachCheckout(
  repo: string,
  opts: { agentId: string; branch: string } & CheckoutSkills,
  git: GitRunner = nodeGitRunner(),
): Promise<AddedWorktree> {
  const worktree = await attachWorktree(repo, { agentId: opts.agentId, branch: opts.branch }, git)
  await settle(repo, worktree.path, git, opts.skills)
  return worktree
}

/**
 * What a checkout gets besides its files. All best-effort: the checkouts are the package's state
 * and hidden from the project's git the moment the first one exists (#1600) — as an untracked
 * directory at the root, `.branches/` would ride any sweeping `git add -A` onto a code branch —
 * through the repository's own exclude file, so no tracked file changes; `node_modules` is
 * gitignored, so a fresh checkout has none and a link that cannot be made is a worse run, not a
 * failed one; a link under `.branches/` is a view, and the next reconcile pass makes it.
 */
async function settle(repo: string, path: string, git: GitRunner, skills: readonly SkillLink[] = []): Promise<void> {
  await excludeFromGit(repo, `/${BRANCHES_DIR}`, undefined, git).catch(() => {})
  await linkDependencies(repo, path).catch(() => [])
  await linkSkill(repo, path, undefined, git, skills)
  await reconcileBranchLinks(repo, { git }).catch(() => {})
}
