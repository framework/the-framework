import { nodeGitRunner, pushBranch, type GitRunner } from '@gemstack/agent-data'
import { isAgentBranch } from './branch-names.js'
import {
  branchPushed,
  currentBranch,
  deleteBranch,
  isWorktreeRoot,
  pruneWorktrees,
  removeWorktree,
  worktreeClean,
} from './worktree.js'

/**
 * Reclaiming a checkout (#752/#737): the one implementation behind every surface that removes
 * one — a daemon's sweep and teardown, a dashboard's Remove button, an agent's own CLI.
 *
 * **One rule: only what is on the remote may go.** The checkout is removed only once the remote
 * has everything it holds: a clean tree, a pushed tip. Every deletion is therefore recoverable,
 * and nothing local is ever the last copy of anything. Nothing is committed on the agent's
 * behalf (#1638): a checkout holding uncommitted work is kept, until a person commits or deletes
 * it. There is one failure mode, and it is legible: the push did not land, so the checkout stays
 * and the refusal says why.
 *
 * What the caller knows and git does not comes in as options: whether the checkout's branch may
 * be pushed at all, and a pushed commit that already holds everything the checkout could.
 */
export interface ReclaimOptions {
  /**
   * The branch the checkout was created on, when that may differ from the branch it ended on: an
   * agent that branched away leaves it behind, and it goes with the checkout once the branch the
   * checkout ended on contains it (#1657).
   */
  birthBranch?: string
  /**
   * Whether the branch may be pushed to satisfy the rule. When not, only a clean tree on a tip the
   * remote already has goes — removing what the remote holds publishes nothing (#1379).
   */
  mayPush: boolean
  /**
   * A commit the remote already has that provably holds everything this checkout could — the commit a
   * cloud session pushed on the agent's behalf, say (#1601). A clean tree whose tip is inside it goes without a push, and keeps
   * its branch. Anything short of that proof falls back to the ordinary rule.
   */
  heldBy?: string
  /** Run once removal is decided, just before the checkout goes: stop what serves the tree. */
  beforeRemove?: () => Promise<void>
  git?: GitRunner
}

/** Why {@link reclaimWorktree} left a checkout where it was. */
export type ReclaimRefusal =
  /** The directory is not a git worktree root: nothing was run in it (#1654). */
  | 'not-a-worktree'
  /** The checkout is on no branch (detached). */
  | 'no-branch'
  /** The tree holds uncommitted work. */
  | 'dirty'
  /** The branch tip is not on the remote, and could not (or may not) be pushed. */
  | 'not-on-remote'

export type ReclaimOutcome =
  | {
      ok: true
      /**
       * Branches that went with the checkout: the branch it was on, when that held nothing the
       * remote lacks (#1650); the birth branch, when everything on it is in the branch that stays
       * (#1657). Absent when nothing went.
       */
      branchesDeleted?: string[]
    }
  | { ok: false; reason: 'not-a-worktree' | 'no-branch' }
  | {
      ok: false
      reason: 'dirty' | 'not-on-remote'
      /** The branch the checkout is on. */
      branch: string
      /** What git said, for a push that did not land. */
      detail?: string
    }

/**
 * Remove one checkout under the rule above. Throws only for a git failure past the decision
 * (the removal itself); every refusal is an outcome.
 */
export async function reclaimWorktree(repo: string, path: string, opts: ReclaimOptions): Promise<ReclaimOutcome> {
  const git = opts.git ?? nodeGitRunner()
  // Before any git runs in it (#1654): a directory under `.branches/` that git does not know as
  // a worktree root makes every command below act on the enclosing repo — the user's checkout,
  // the user's branch. Nothing is pushed or deleted through it; it is left where it is.
  if (!(await isWorktreeRoot(path, git))) return { ok: false, reason: 'not-a-worktree' }
  const branch = await currentBranch(path, git)
  if (!branch) return { ok: false, reason: 'no-branch' }
  // Every way out below needs a clean tree: `removeWorktree` forces past a dirty one, so a dirty
  // tree is kept (#1638), and so is a tree git cannot read. Asked once, for all of them.
  if (!(await worktreeClean(path, git).catch(() => false))) return { ok: false, reason: 'dirty', branch }

  // Whether the checkout's branch goes with it (#1650): only when it provably holds nothing.
  let emptyBranch = false
  if (opts.heldBy && (await coveredBy(path, branch, opts.heldBy, git))) {
    // A tip inside a commit the remote already has: nothing to push (#1601).
  } else if (isAgentBranch(branch) && (await branchHoldsNothing(repo, branch, git))) {
    // A branch whose tip the remote already has under another name — an agent that committed
    // nothing (#1650). The rule is satisfied before any push: what the checkout holds *is* on
    // the remote, so the branch goes with it; it is not the last copy of anything, by
    // construction. Only a branch minted for an agent, though: a leftover checkout can sit on
    // the user's own branch (one was found on `main`), and deleting that is not this code's call
    // even when it holds nothing — git's refusal to delete a checked-out branch must never be
    // the guard.
    emptyBranch = true
  } else {
    if (!(await branchPushed(repo, branch, git))) {
      if (!opts.mayPush) return { ok: false, reason: 'not-on-remote', branch }
      // Pushing is what makes the removal recoverable, so it is attempted here rather than
      // required of the caller. A repo with no remote never gets past this, which is the honest
      // answer: there is nowhere for the work to be recoverable from.
      const pushed = await pushBranch(repo, branch, git)
      if (!pushed.ok) return { ok: false, reason: 'not-on-remote', branch, detail: pushed.error }
    }
  }

  // The birth branch (#1657) is judged before anything is deleted: the containment reads both refs.
  // Only a branch the package minted: the rule that guards the checkout's own branch guards this one.
  const birthBranchGoes =
    opts.birthBranch !== undefined && opts.birthBranch !== branch && isAgentBranch(opts.birthBranch) && (await branchContains(repo, branch, opts.birthBranch, git))
  await opts.beforeRemove?.()
  await removeWorktree(repo, path, git)
  await pruneWorktrees(repo, git)
  // After the checkout: git refuses to delete a branch a worktree still has checked out.
  const deleted: string[] = []
  if (emptyBranch) {
    await deleteBranch(repo, branch, git)
    deleted.push(branch)
  }
  if (birthBranchGoes && opts.birthBranch) {
    await deleteBranch(repo, opts.birthBranch, git)
    deleted.push(opts.birthBranch)
  }
  return deleted.length ? { ok: true, branchesDeleted: deleted } : { ok: true }
}

/** Whether the branch tip is an ancestor of `anchor`. False on any doubt. */
async function coveredBy(path: string, branch: string, anchor: string, git: GitRunner): Promise<boolean> {
  return git(['merge-base', '--is-ancestor', branch, anchor], path).then(
    () => true,
    () => false,
  )
}

/**
 * Whether a branch holds nothing the remote lacks (#1650): the tip is
 * reachable from some remote-tracking branch *other than the branch's own* — a commit `origin`
 * already has under another name, so nothing on the branch is unique to it. Its own remote copy
 * does not count: a pushed branch with a PR contains its own tip and is exactly the branch that
 * must stay. The branch's own copy is the one under its name, and the one it tracks — a branch
 * renamed after it was pushed (#1725) still tracks the remote copy under its old name, and that
 * copy holding the tip proves nothing about another name having it. Read from the local
 * remote-tracking refs, which are only ever behind the remote: a tip they do not cover yet
 * answers false, and the caller falls back to the push.
 */
async function branchHoldsNothing(repo: string, branch: string, git: GitRunner): Promise<boolean> {
  const upstream = await git(['rev-parse', '--abbrev-ref', `${branch}@{upstream}`], repo).then(
    out => out.trim(),
    () => undefined,
  )
  return git(['branch', '--remotes', '--contains', `refs/heads/${branch}`, '--format=%(refname:short)'], repo).then(
    out =>
      out
        .split('\n')
        .map(line => line.trim())
        .some(name => name !== '' && !name.endsWith(`/${branch}`) && name !== upstream),
    () => false,
  )
}

/** Whether `inner` exists and is an ancestor of (or equal to) `outer` — everything on it is on `outer` too. */
async function branchContains(repo: string, outer: string, inner: string, git: GitRunner): Promise<boolean> {
  return git(['merge-base', '--is-ancestor', `refs/heads/${inner}`, `refs/heads/${outer}`], repo).then(
    () => true,
    () => false,
  )
}
