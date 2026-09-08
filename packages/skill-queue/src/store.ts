import { join } from 'node:path'
import { DATA_BRANCH, nodeBranchFileFs, nodeGitRunner, pullFileBranch, withFileBranch, type BranchFileFs, type CommitMessage, type FileBranchSync, type FileBranchWrite, type GitRunner } from '@gemstack/agent-data'
import { QUEUE_FILE } from './names.js'

// Where the queue lives, bound to the branch: `TODO_AGENTS.md` at the root of the `agent-data`
// branch of the project's repository, checked out under `.branches/agent-data` for a long-lived
// process.

/** The plain-file seams an operation on the branch's files needs. */
export type QueueFiles = BranchFileFs

/**
 * A caller's write funnel: apply `op` to a checkout of the branch, commit, push. The daemon's is
 * the persistent checkout's serialized cycle; a test's fake stands in.
 */
export type QueueFunnel = (root: string, message: CommitMessage, op: (dir: string) => Promise<void>) => Promise<FileBranchWrite>

/** Injectable seams so every operation is unit-testable off disk and git; production takes the defaults. */
export interface QueueDeps extends Partial<QueueFiles> {
  funnel?: QueueFunnel
  log?: (message: string) => void
}

/** The default funnel: the persistent checkout's write cycle, on the `agent-data` branch. */
export const queueFunnel: QueueFunnel = (root, message, op) => withFileBranch(root, DATA_BRANCH, message, op)

/** Fill in whatever a caller left out, so an operation reads the same way in tests and out. */
export function resolveQueueDeps(deps: QueueDeps): QueueFiles & { funnel: QueueFunnel; log: (message: string) => void } {
  const fs = nodeBranchFileFs()
  return {
    read: deps.read ?? fs.read,
    write: deps.write ?? fs.write,
    remove: deps.remove ?? fs.remove,
    list: deps.list ?? fs.list,
    funnel: deps.funnel ?? queueFunnel,
    log: deps.log ?? (() => {}),
  }
}

/**
 * Bring a long-lived process's view of the branch up to date: the branch and its persistent
 * checkout exist, the queue file is seeded on a branch born empty (so readers and people find a
 * file, not a mystery), and the checkout converges with origin — reading what other machines and
 * cloud sessions pushed, and pushing anything an earlier cycle left stranded. Reports why it
 * could not converge; never throws.
 */
export async function syncQueue(root: string, deps: QueueDeps & { git?: GitRunner } = {}): Promise<FileBranchSync> {
  const r = resolveQueueDeps(deps)
  const seeded = await r.funnel(root, 'seed the queue', async dir => {
    const queue = join(dir, QUEUE_FILE)
    if (!(await r.read(queue).then(() => true, () => false))) await r.write(queue, '')
  })
  if (!seeded.ok && !seeded.committed) return { ok: false, error: seeded.error }
  return pullFileBranch(root, DATA_BRANCH, { git: deps.git ?? nodeGitRunner(), log: r.log })
}
