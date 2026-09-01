import { basename, dirname } from 'node:path'
import { BRANCHES_DIR, checkoutRoot, nodeGitRunner, type GitRunner } from '@gemstack/agent-data'
import { agentIdFromWorktreeDir, currentBranch, isAgentBranch } from '@gemstack/skill-branches'

/**
 * Who the command claims as, read from where it runs — nothing for the agent to type or know.
 *
 * Inside an agent's checkout (`.branches/agent-<id>`) the holder is the agent id: the checkout
 * directory keeps it for the checkout's life, unlike the branch, which is renamed once the agent
 * names its session — a lock naming the branch would go stale at the first rename. Anywhere else
 * the holder is the current branch name: a cloud session on its own branch, a person on a feature
 * branch. A detached HEAD names nobody.
 */
export type Holder = { ok: true; holder: string } | { ok: false; reason: 'no-identity' }

export async function holderOf(cwd: string, git: GitRunner = nodeGitRunner()): Promise<Holder> {
  const checkout = await checkoutRoot(cwd, git)
  const dir = basename(checkout)
  if (basename(dirname(checkout)) === BRANCHES_DIR && isAgentBranch(dir)) return { ok: true, holder: agentIdFromWorktreeDir(dir) }
  const branch = await currentBranch(checkout, git)
  return branch ? { ok: true, holder: branch } : { ok: false, reason: 'no-identity' }
}
