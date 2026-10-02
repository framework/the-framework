import { nodeGitRunner, originDefaultBranch, pushBranch, type GitRunner } from '@gemstack/agent-data'
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
 * one — a scheduler at a run's end and in its sweep, a dashboard's Remove button, the CLI.
 *
 * **One rule: only what is on the remote may go.** The checkout is removed only once the remote
 * has everything it holds: a clean tree, a pushed tip. Every deletion is therefore recoverable,
 * and nothing local is ever the last copy of anything. Nothing is committed on the agent's
 * behalf (#1638): a checkout holding uncommitted work is kept, until a person commits or deletes
 * it. There is one failure mode, and it is legible: the push did not land, so the checkout stays
 * and the refusal says why.
 *
 * What the caller knows and git does not comes in as options: whether the checkout's branch may
 * be pushed at all, the commit its branch started from, and a pushed commit that already holds
 * everything the checkout could.
 */
export interface ReclaimOptions {
  /**
   * The branch the checkout was created on, when that may differ from the branch it ended on: an
   * agent that branched away leaves it behind, and it goes with the checkout once the branch the
   * checkout ended on contains it (#1657).
   */
  birthBranch?: string
  /**
   * Whether an agent's branch may be pushed to satisfy the rule; any other branch never is. When
   * not, only a clean tree on a tip the remote already has goes — removing what the remote holds
   * publishes nothing (#1379).
   */
  mayPush: boolean
  /**
   * The commit the checkout's branch started from, when that is not origin's default branch: a
   * branch started from another branch. A branch with no commit past it holds nothing of its own.
   */
  from?: string
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
       * Branches that went with the checkout: the branch it was on, when that held nothing of
       * its own (#1650); the birth branch, when everything on it is in the branch that stays
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
  if (opts.heldBy && (await isAncestor(path, branch, opts.heldBy, git))) {
    // A tip inside a commit the remote already has: nothing to push (#1601).
  } else if (await branchHoldsNothing(repo, branch, opts, git)) {
    // A branch with no commit past where it started — an agent that committed nothing (#1650).
    // The rule is satisfied before any push: what the checkout holds *is* on the remote, under
    // another name, so the checkout goes. The branch goes with it only when it was minted for an
    // agent: a leftover checkout can sit on the user's own branch (one was found on `main`), and
    // deleting that is not this code's call even when it holds nothing — git's refusal to delete
    // a checked-out branch must never be the guard.
    emptyBranch = isAgentBranch(branch)
  } else if (!(await branchPushed(repo, branch, git))) {
    // Pushing is what makes the removal recoverable, so it is attempted here rather than
    // required of the caller. A repo with no remote never gets past this, which is the honest
    // answer: there is nowhere for the work to be recoverable from. Only a branch minted for an
    // agent, though: a checkout continued on the user's own branch (even `main`) is kept, since
    // pushing that branch is the user's call, never a cleanup's.
    if (!opts.mayPush || !isAgentBranch(branch)) return { ok: false, reason: 'not-on-remote', branch }
    const pushed = await pushBranch(repo, branch, git)
    if (!pushed.ok) return { ok: false, reason: 'not-on-remote', branch, detail: pushed.error }
  }

  // The birth branch (#1657) is judged before anything is deleted: the containment reads both refs.
  // Only a branch the package minted: the rule that guards the checkout's own branch guards this one.
  const birthBranchGoes =
    opts.birthBranch !== undefined && opts.birthBranch !== branch && isAgentBranch(opts.birthBranch) && (await isAncestor(repo, `refs/heads/${opts.birthBranch}`, `refs/heads/${branch}`, git))
  await opts.beforeRemove?.()
  await removeWorktree(repo, path, git)
  await pruneWorktrees(repo, git)
  // After the checkout: git refuses to delete a branch a worktree still has checked out.
  // Only a branch that actually went is named: git refuses to delete a branch another worktree
  // has checked out, and the caller must not report that one as gone.
  const deleted: string[] = []
  if (emptyBranch && (await deleteBranch(repo, branch, git))) deleted.push(branch)
  if (birthBranchGoes && opts.birthBranch && (await deleteBranch(repo, opts.birthBranch, git))) deleted.push(opts.birthBranch)
  return deleted.length ? { ok: true, branchesDeleted: deleted } : { ok: true }
}

/**
 * Discard one checkout (#1774): it goes whatever it holds, uncommitted work included, nothing
 * pushed. A person's call, for a run they are throwing away, where the rule above would keep
 * the checkout. The branch and its commits stay: deleting a branch that may carry an open pull
 * request is git's business, never this tool's on the way out of a checkout. Only the
 * not-a-worktree guard applies: a directory git does not know as a worktree is left alone.
 */
export async function discardWorktree(repo: string, path: string, opts: Pick<ReclaimOptions, 'git' | 'beforeRemove'> = {}): Promise<{ ok: true } | { ok: false; reason: 'not-a-worktree' }> {
  const git = opts.git ?? nodeGitRunner()
  if (!(await isWorktreeRoot(path, git))) return { ok: false, reason: 'not-a-worktree' }
  await opts.beforeRemove?.()
  await git(['worktree', 'remove', '--force', path], repo)
  await pruneWorktrees(repo, git)
  return { ok: true }
}

/**
 * Whether a branch holds nothing of its own (#1650): no commit past where it started. Where it
 * started is the commit the caller names, which some remote-tracking branch *other than the
 * branch's own* must hold, so the commit is on the remote whatever happens to this branch; with
 * none named, origin's default branch, where every agent branch starts unless told otherwise.
 *
 * Not "the tip is on the remote under another name", the earlier test: a branch another agent was
 * started from has its tip inside that agent's branch once that one is pushed, and it is still
 * the only branch that work is its own on.
 *
 * The branch's own copies are the remote-tracking ref under its name and the one under its birth
 * name — a branch renamed after it was pushed (#1725) left its remote copy under the old name,
 * and that copy holding a commit proves nothing about another name having it. Read from the local
 * remote-tracking refs, which are only ever behind the remote: a commit they do not cover yet
 * answers false, and the caller falls back to the push.
 */
async function branchHoldsNothing(repo: string, branch: string, opts: Pick<ReclaimOptions, 'birthBranch' | 'from'>, git: GitRunner): Promise<boolean> {
  const tip = `refs/heads/${branch}`
  if (opts.from === undefined) {
    const start = await originDefaultBranch(repo, git)
    return start !== undefined && (await isAncestor(repo, tip, `refs/remotes/${start}`, git))
  }
  // The commit itself, never the caller's words handed on to git; one this machine lacks proves nothing.
  const from = await git(['rev-parse', '--verify', '--quiet', '--end-of-options', `${opts.from}^{commit}`], repo).then(out => out.trim(), () => '')
  if (!from || !(await isAncestor(repo, tip, from, git))) return false
  const own = [branch, opts.birthBranch].filter(name => name !== undefined).map(name => `/${name}`)
  return git(['branch', '--remotes', '--contains', from, '--format=%(refname:short)'], repo).then(
    out =>
      out
        .split('\n')
        .map(line => line.trim())
        .some(name => name !== '' && !own.some(suffix => name.endsWith(suffix))),
    () => false,
  )
}

/** Whether `inner` is `outer` or an ancestor of it — everything on it is on `outer` too. False on any doubt. */
async function isAncestor(cwd: string, inner: string, outer: string, git: GitRunner): Promise<boolean> {
  return git(['merge-base', '--is-ancestor', inner, outer], cwd).then(
    () => true,
    () => false,
  )
}
