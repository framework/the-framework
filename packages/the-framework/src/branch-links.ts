import { join } from 'node:path'
import { nodeGitRunner, type GitRunner } from './project.js'
import { FRAMEWORK_DIR, WORKTREES_DIR, listWorktreeDirs, worktreePath, currentBranch } from './store/index.js'

// The flat branches view (#1580): `.the-framework/branches/` holds one symlink per agent
// worktree, named as the worktree's current branch, plus a `branches` symlink at the repo root
// pointing there — so `cd branches/<name>` reaches any session's checkout by the name the
// dashboard shows. #1581 (slash-free branch names) is what lets a branch name be a link name.
//
// Links, not moves (Rom's call on #1589): the worktrees themselves stay at
// `.the-framework/worktrees/<agentId>`, so nothing that derives paths from agent ids changes,
// and a branch rename costs a link rename instead of moving a checkout under a live agent.
// The daemon reconciles on its clock and after each worktree it allocates: derive the wanted
// links from the worktrees on disk, add what is missing, drop only our own stale links.

/** Where the per-branch links live, under `.the-framework/` (gitignored like the worktrees). */
export const BRANCH_LINKS_DIR = 'branches'

/** The filesystem the reconcile needs; `node:fs/promises` in production. */
export interface LinksFs {
  /** Names under `dir`; a missing dir yields `[]`. */
  readdir(dir: string): Promise<string[]>
  /** Recursive mkdir. */
  mkdir(dir: string): Promise<void>
  /** Create a symlink at `path` pointing to `target`. */
  symlink(target: string, path: string): Promise<void>
  /** A symlink's target, or `undefined` when `path` is missing or not a symlink. */
  readlink(path: string): Promise<string | undefined>
  /** Remove one file or symlink. */
  unlink(path: string): Promise<void>
  /** Whether anything (file, dir, or dangling link) sits at `path`. */
  lexists(path: string): Promise<boolean>
}

/** A {@link LinksFs} over `node:fs/promises`, dynamically imported like {@link nodeDirLister}. */
export function nodeLinksFs(): LinksFs {
  const fs = () => import('node:fs/promises')
  return {
    readdir: dir => fs().then(f => f.readdir(dir)).catch(() => []),
    mkdir: dir => fs().then(f => f.mkdir(dir, { recursive: true })).then(() => {}),
    symlink: (target, path) => fs().then(f => f.symlink(target, path)),
    readlink: path => fs().then(f => f.readlink(path)).catch(() => undefined),
    unlink: path => fs().then(f => f.unlink(path)),
    lexists: path => fs().then(f => f.lstat(path)).then(() => true, () => false),
  }
}

/** Injectable seams for {@link reconcileBranchLinks}. */
export interface BranchLinksDeps {
  git?: GitRunner
  fs?: LinksFs
  /** The agent ids with a worktree (default {@link listWorktreeDirs}). */
  worktrees?: (cwd: string) => Promise<string[]>
  /** The branch a worktree is on (default {@link currentBranch}). */
  branchOf?: (path: string) => Promise<string | undefined>
}

/**
 * Bring one project's `branches/` links in line with its worktrees: one link per worktree, named
 * as the branch the worktree is on right now, plus the repo-root shortcut. Renames are covered by
 * the same rule — the old name stops being wanted and is dropped, the new one is created.
 *
 * Touches only what is provably ours: a link is created, replaced, or removed only when it points
 * (or would point) into `worktrees/`; anything else at those paths — a user's own file, dir, or
 * symlink — is left alone. Never throws.
 */
export async function reconcileBranchLinks(cwd: string, deps: BranchLinksDeps = {}): Promise<void> {
  const git = deps.git ?? nodeGitRunner()
  const fs = deps.fs ?? nodeLinksFs()
  const worktrees = deps.worktrees ?? listWorktreeDirs
  const branchOf = deps.branchOf ?? ((path: string) => currentBranch(path, git))

  const linksDir = join(cwd, FRAMEWORK_DIR, BRANCH_LINKS_DIR)
  /** Link name -> relative target, derived from what is actually checked out. */
  const wanted = new Map<string, string>()
  for (const agentId of await worktrees(cwd).catch((): string[] => [])) {
    const branch = await branchOf(worktreePath(cwd, agentId)).catch(() => undefined)
    // A detached worktree has no name to link; a slashed name (a pre-#1581 branch) cannot be a
    // link name at all — both simply get no link.
    if (!branch || branch.includes('/')) continue
    wanted.set(branch, join('..', WORKTREES_DIR, agentId))
  }

  // Drop our stale links: entries that are symlinks into `worktrees/` but no longer wanted, or
  // wanted with a different target (a reused branch name now belongs to a newer worktree).
  const ourTargets = join('..', WORKTREES_DIR) + '/'
  for (const name of await fs.readdir(linksDir)) {
    const path = join(linksDir, name)
    const target = await fs.readlink(path)
    if (target === undefined || !target.startsWith(ourTargets)) continue // not ours to touch
    if (wanted.get(name) === target) continue
    await fs.unlink(path).catch(() => {})
  }

  for (const [name, target] of wanted) {
    const path = join(linksDir, name)
    if (await fs.lexists(path)) continue // ours-and-current, or someone else's — either way, stay
    await fs.mkdir(linksDir)
    await fs.symlink(target, path).catch(() => {})
  }

  // The repo-root `branches` shortcut (#1580). Relative, so a checkout that moves keeps working;
  // created only when nothing sits at that path — a user's own `branches` file or dir is theirs.
  const rootLink = join(cwd, 'branches')
  if (!(await fs.lexists(rootLink))) {
    await fs.mkdir(linksDir)
    await fs.symlink(join(FRAMEWORK_DIR, BRANCH_LINKS_DIR), rootLink).catch(() => {})
  }
}

/** A running reconcile pass, in the shape the daemon's other background services use. */
export interface BranchLinksPass {
  /** Run one pass now, awaiting it. */
  tick: () => Promise<void>
  stop: () => void
}

/** What {@link startBranchLinksPass} needs from the daemon. */
export interface BranchLinksOptions {
  projects: () => Promise<readonly { path: string }[]>
  /** The per-project reconcile (default {@link reconcileBranchLinks}). */
  reconcile?: (cwd: string) => Promise<void>
}

/**
 * Keep every registered project's branch links current, one turn per call. Runs on the daemon's
 * clock; renames and reclaimed worktrees settle within a tick, and a freshly-allocated worktree
 * gets its link immediately because allocation calls the reconcile too. Quiet on purpose: links
 * are presentation, and narrating every rename would drown the log.
 */
export function startBranchLinksPass(opts: BranchLinksOptions): BranchLinksPass {
  const reconcile = opts.reconcile ?? reconcileBranchLinks
  let stopped = false

  const passAll = async (): Promise<void> => {
    for (const project of await opts.projects().catch(() => [])) {
      if (stopped) break
      await reconcile(project.path).catch(() => {})
    }
  }

  // Same overlap rule as the worktree sweep: awaiting `tick()` means the pass finished.
  let inflight: Promise<void> | undefined
  const tick = (): Promise<void> => {
    if (stopped) return Promise.resolve()
    inflight ??= passAll().finally(() => {
      inflight = undefined
    })
    return inflight
  }

  return {
    tick,
    stop: () => {
      stopped = true
    },
  }
}
