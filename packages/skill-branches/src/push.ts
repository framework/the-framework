import { nodeGitRunner, pushBranch, type GitRunner } from '@gemstack/agent-data'
import { currentBranch, isWorktreeRoot, projectRoot, worktreeBranch, worktreeClean, worktreeDirEntries } from './worktree.js'

/**
 * Pushing a branch to origin (#1820): the last git step of an agent's work, and the step before
 * whatever the project's git host package does with the branch. This package knows git and nothing
 * beyond it: the pull request, if the project has a git host, is another package's command.
 *
 * One rule before the push: the tree is clean, since what is pushed is what is committed, and
 * nothing is committed on the agent's behalf.
 *
 * A person pushes a finished agent's branch through the same door, by name (`pushBranchByName`):
 * the agent's checkout when one is still on the branch, under the same clean rule; else the
 * branch itself, pushed when this machine has it, left as it is when only origin does.
 */

/** Why a branch was not pushed. */
export type PushRefusal =
  /** The directory is not a git worktree root. */
  | 'not-a-worktree'
  /** The checkout is on no branch; or, by name, neither this machine nor origin has the branch. */
  | 'no-branch'
  /** The tree holds uncommitted work: commit or delete it first. */
  | 'dirty'
  /** The branch could not be pushed. */
  | 'push-failed'

export type PushOutcome =
  /** `pushed` is false when only origin had the branch: nothing here to push, and nothing missing there. */
  | { ok: true; branch: string; pushed: boolean }
  | { ok: false; reason: 'not-a-worktree' }
  | { ok: false; reason: 'no-branch'; branch?: string }
  | { ok: false; reason: 'dirty' | 'push-failed'; branch: string; detail?: string }

/** Push the branch the checkout at `path` is on, once the checkout is clean. */
export async function pushCheckout(path: string, git: GitRunner = nodeGitRunner()): Promise<PushOutcome> {
  if (!(await isWorktreeRoot(path, git))) return { ok: false, reason: 'not-a-worktree' }
  const branch = await currentBranch(path, git)
  if (!branch) return { ok: false, reason: 'no-branch' }
  if (!(await worktreeClean(path, git).catch(() => false))) return { ok: false, reason: 'dirty', branch }
  const pushed = await pushBranch(await projectRoot(path, git), branch, git)
  if (!pushed.ok) return { ok: false, reason: 'push-failed', branch, detail: pushed.error }
  return { ok: true, branch, pushed: true }
}

/**
 * Push a branch by name, from the project: the caller's form, for a person landing a finished
 * agent's work. The checkout under `.branches/` that is on the branch, when one is, is pushed as
 * the agent would push it, its clean rule included. Without one, the branch itself: pushed when
 * this machine has it; left as it is when only `origin` has it (a branch pushed from elsewhere,
 * with nothing here to push). Neither: `no-branch`.
 */
export async function pushBranchByName(repo: string, branch: string, git: GitRunner = nodeGitRunner()): Promise<PushOutcome> {
  for (const entry of await worktreeDirEntries(repo)) {
    if ((await worktreeBranch(entry.path, git)) === branch) return pushCheckout(entry.path, git)
  }
  const local = await git(['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`], repo).then(out => out.trim() !== '', () => false)
  if (local) {
    const pushed = await pushBranch(repo, branch, git)
    if (!pushed.ok) return { ok: false, reason: 'push-failed', branch, detail: pushed.error }
    return { ok: true, branch, pushed: true }
  }
  const remote = await git(['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${branch}`], repo).then(out => out.trim() !== '', () => false)
  if (!remote) return { ok: false, reason: 'no-branch', branch }
  return { ok: true, branch, pushed: false }
}
