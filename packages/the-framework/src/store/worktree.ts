import { join } from 'node:path'
import { nodeGitRunner, type GitRunner } from '../project.js'
import { FRAMEWORK_DIR, WORKTREES_DIR, isSafeAgentId } from './agent-store.js'

/**
 * Git-worktree lifecycle for concurrent agents (#453/#735): give each agent its own
 * checkout so N runs on one repo never fight over the working tree. Pure plumbing
 * over the existing {@link GitRunner} seam; no daemon wiring, no concurrency, no
 * dashboard changes (those are the sibling #453 slices). This module only knows
 * how to add, list, remove, and prune worktrees.
 */

/** The path an agent's worktree gets: `<repo>/.the-framework/worktrees/<agentId>`. */
export function worktreePath(repo: string, agentId: string): string {
  return join(repo, FRAMEWORK_DIR, WORKTREES_DIR, agentId)
}

export {
  AGENT_BRANCH_PREFIX,
  LEGACY_AGENT_BRANCH_PREFIX,
  agentBranchName,
  legacyAgentBranchName,
} from '../branch-names.js'

/** One entry parsed from `git worktree list --porcelain`. */
export interface WorktreeInfo {
  /** Absolute worktree path (the main checkout included). */
  path: string
  /** The checked-out commit. */
  head: string
  /** The checked-out branch (short name), or absent when detached. */
  branch?: string
}

/** Inputs to {@link addWorktree}. The caller owns branch naming (#736). */
export interface AddWorktreeOptions {
  agentId: string
  /** The branch to create for the agent. */
  branch: string
  /** Base ref to branch from; defaults to the repo's current HEAD. */
  base?: string
}

/** The worktree {@link addWorktree} created. */
export interface AddedWorktree {
  path: string
  branch: string
}

/**
 * Create a worktree for an agent on a fresh branch: `git worktree add -b <branch>
 * <path> [base]`. Git makes the leaf dir (and any missing parents) itself. The
 * `agentId` is validated as path-safe first so a caller can never traverse out of
 * `.the-framework/worktrees/`. Rejects on any git failure (a caller that wants a
 * run needs its checkout, so failure must surface, not be swallowed).
 */
export async function addWorktree(
  repo: string,
  opts: AddWorktreeOptions,
  agent: GitRunner = nodeGitRunner(),
): Promise<AddedWorktree> {
  if (!isSafeAgentId(opts.agentId)) throw new Error(`unsafe run id: ${opts.agentId}`)
  const path = worktreePath(repo, opts.agentId)
  await agent(['worktree', 'add', '-b', opts.branch, path, ...(opts.base ? [opts.base] : [])], repo)
  return { path, branch: opts.branch }
}

/**
 * Check an *existing* branch out into an agent's worktree (#762): `git worktree add <path> <branch>`,
 * no `-b`. Continuing an agent puts it back on the branch its work is already on, rather than
 * branching again from HEAD and stranding what it did last time.
 *
 * Rejects on git failure, like {@link addWorktree}: a continued agent needs its checkout.
 */
export async function attachWorktree(
  repo: string,
  opts: { agentId: string; branch: string },
  agent: GitRunner = nodeGitRunner(),
): Promise<AddedWorktree> {
  if (!isSafeAgentId(opts.agentId)) throw new Error(`unsafe run id: ${opts.agentId}`)
  const path = worktreePath(repo, opts.agentId)
  await agent(['worktree', 'add', path, opts.branch], repo)
  return { path, branch: opts.branch }
}

/**
 * Every worktree registered for the repo (the main checkout included). Forgiving:
 * a non-repo / git failure yields `[]` so a reconcile scan never throws.
 */
export async function listWorktrees(repo: string, agent: GitRunner = nodeGitRunner()): Promise<WorktreeInfo[]> {
  try {
    return parseWorktreeList(await agent(['worktree', 'list', '--porcelain'], repo))
  } catch {
    return []
  }
}

/**
 * Parse `git worktree list --porcelain`: blank-line-separated records, each with
 * a `worktree <path>` line, a `HEAD <sha>` line, and either `branch refs/heads/...`
 * or `detached`. Extra attributes (bare/locked/prunable) are ignored. Exported so
 * the parsing is unit-testable without a real repo.
 */
export function parseWorktreeList(porcelain: string): WorktreeInfo[] {
  const entries: WorktreeInfo[] = []
  for (const block of porcelain.split(/\n\s*\n/)) {
    let path: string | undefined
    let head = ''
    let branch: string | undefined
    for (const line of block.split('\n')) {
      if (line.startsWith('worktree ')) path = line.slice('worktree '.length).trim()
      else if (line.startsWith('HEAD ')) head = line.slice('HEAD '.length).trim()
      else if (line.startsWith('branch ')) branch = line.slice('branch '.length).trim().replace(/^refs\/heads\//, '')
    }
    if (path) entries.push({ path, head, ...(branch ? { branch } : {}) })
  }
  return entries
}

/**
 * Commit whatever the agent left behind, on the agent's own branch (#786).
 *
 * An agent that edits and stops without committing is behaving as instructed: the
 * system prompt has it commit *pre-existing* changes before it starts, never its own
 * work at the end. Removing that checkout would destroy the diff (the work was never
 * staged, so it is not recoverable from git afterwards), so teardown commits it first
 * and the branch outlives the worktree.
 *
 * Returns whether the checkout is safe to remove: true when it was already clean or
 * the work is now committed, false when the commit failed (no git identity, a hook
 * refusing it). False means keep the checkout, which is the safe direction.
 *
 * Retries before giving up (#1376): the daemon's conversation committer works in the same
 * checkout and is busiest exactly when this runs (session end), so a first attempt can lose
 * an `index.lock` race. That transient loss is how a session's real work got judged
 * "committed nothing" by the handoff while the teardown's identical commit, seconds later,
 * succeeded. A short wait outlasts the committer's hold; a persistent failure (identity,
 * hooks) still comes back false.
 */
export async function commitPendingWork(
  path: string,
  agent: GitRunner = nodeGitRunner(),
  retry: { attempts?: number; delayMs?: number } = {},
): Promise<boolean> {
  const attempts = Math.max(1, retry.attempts ?? 3)
  const delayMs = retry.delayMs ?? 300
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const status = await agent(['status', '--porcelain'], path)
      if (!status.trim()) return true
      await agent(['add', '-A'], path)
      // Same wording as the install-time safety commit (install.ts), for one vocabulary.
      await agent(['commit', '-m', '[The Framework] uncommitted changes'], path)
      return true
    } catch {
      if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }
  return false
}

/**
 * Remove an agent's worktree. Tolerant of an already-gone / never-registered path so
 * teardown stays idempotent (the agent child is detached; the daemon only holds its pid).
 *
 * Plain removal first: it refuses a checkout git considers unclean, which after
 * {@link commitPendingWork} means a state we did not anticipate. Falling back to
 * `--force` keeps teardown working (an ignored build artifact must not strand a
 * worktree forever), but it says so, because forcing past unknown state is exactly
 * how uncommitted work got deleted in the first place.
 */
export async function removeWorktree(repo: string, path: string, agent: GitRunner = nodeGitRunner()): Promise<void> {
  try {
    await agent(['worktree', 'remove', path], repo)
    return
  } catch {
    // Unclean by git's reckoning, already removed, or never registered: try forcing.
  }
  try {
    await agent(['worktree', 'remove', '--force', path], repo)
    console.log(`[framework] forced removal of worktree ${path} (git called it unclean)`)
  } catch {
    // Already removed, or never registered: nothing to do.
  }
}

/**
 * The branch checked out at `path`, or `undefined` when detached / not a repo.
 * Forgiving, like {@link listWorktrees}: callers use it to decide, not to fail.
 */
export async function currentBranch(path: string, agent: GitRunner = nodeGitRunner()): Promise<string | undefined> {
  try {
    const name = (await agent(['rev-parse', '--abbrev-ref', 'HEAD'], path)).trim()
    return name && name !== 'HEAD' ? name : undefined
  } catch {
    return undefined
  }
}

/**
 * Rename an agent's branch once the agent names the session (#736): the worktree is
 * created on `tf-agent-<agentId>` before a name exists, and this puts the
 * readable `tf-<sessionName>` on it.
 *
 * Only renames when `path` is still on `from`. The #326 system prompt currently
 * tells the agent to create and check out its own `tf-<name>` branch,
 * and until that step is dropped there (the prompt ships verbatim from the issue,
 * so it is not ours to edit) the agent may already have moved off `from` — in
 * which case it named the branch itself and there is nothing to rename. Returns
 * whether it renamed, and never throws: an agent must not die over a branch name.
 */
export async function renameAgentBranch(
  path: string,
  from: string,
  to: string,
  agent: GitRunner = nodeGitRunner(),
): Promise<boolean> {
  if ((await currentBranch(path, agent)) !== from) return false
  try {
    await agent(['branch', '-m', from, to], path)
    return true
  } catch {
    // Target name taken, or an invalid slug: keep the run-id branch.
    return false
  }
}

/**
 * `git worktree prune`: drop administrative entries for worktree dirs a crash left
 * behind. Never removes a live worktree, so it is always safe. Forgiving.
 */
export async function pruneWorktrees(repo: string, agent: GitRunner = nodeGitRunner()): Promise<void> {
  try {
    await agent(['worktree', 'prune'], repo)
  } catch {
    // Not a repo / nothing to prune: no-op.
  }
}

/** Runs `du`, resolving its stdout. Injectable so the size read can be tested without a real tree. */
export type SizeRunner = (path: string) => Promise<string>

/** A {@link SizeRunner} over `du -sk`: one process, and it does not follow the symlinked deps (#736). */
export function nodeSizeRunner(): SizeRunner {
  return path =>
    new Promise((resolvePromise, rejectPromise) => {
      void import('node:child_process').then(({ execFile }) => {
        execFile('du', ['-sk', path], { timeout: 5_000 }, (err, stdout) =>
          err ? rejectPromise(err) : resolvePromise(stdout),
        )
      })
    })
}

/**
 * A worktree's size on disk in bytes, or undefined when it cannot be read (#798). Best-effort by
 * design: this only ever labels a "remove this" button, so a missing number costs nothing while a
 * throw or a hang would cost the panel it sits in. `du` is absent on Windows, which reads as
 * unknown like any other failure.
 */
export async function worktreeSize(path: string, agent: SizeRunner = nodeSizeRunner()): Promise<number | undefined> {
  try {
    const kb = Number.parseInt((await agent(path)).trim().split(/\s+/)[0] ?? '', 10)
    return Number.isFinite(kb) ? kb * 1024 : undefined
  } catch {
    return undefined
  }
}

/**
 * Whether a branch is on the remote, with the local tip already there (E5).
 *
 * The one predicate the whole retention story is built on: nothing local is ever the last copy of
 * work, so anything the remote has may be deleted and anything it does not have stays. It replaced
 * three interacting rules — a clean finish removes the checkout, a failure keeps it, a merged
 * branch reclaims it later — each of which asked *what state did this session end in* rather than
 * *is this recoverable*.
 *
 * `git rev-parse` of the remote-tracking ref, then a merge-base check: the ref existing is not
 * enough, because a branch pushed and then committed to again has a tip the remote has never seen.
 * Reads only local refs (no fetch), so it is cheap enough to ask on every teardown — the remote ref
 * is written by the push this is checking for, which is what makes that sound.
 *
 * Anything unreadable answers `false`. A repo with no remote configured therefore keeps every
 * checkout, which is the honest outcome: there is nowhere for the work to be recoverable from.
 */
export async function branchPushed(
  repo: string,
  branch: string,
  agent: GitRunner = nodeGitRunner(),
): Promise<boolean> {
  try {
    const local = (await agent(['rev-parse', '--verify', `refs/heads/${branch}`], repo)).trim()
    const remote = (await agent(['rev-parse', '--verify', `refs/remotes/origin/${branch}`], repo)).trim()
    if (!local || !remote) return false
    if (local === remote) return true
    // The remote may be ahead (someone pushed on top): what matters is that our tip is in it.
    await agent(['merge-base', '--is-ancestor', local, remote], repo)
    return true
  } catch {
    return false
  }
}
