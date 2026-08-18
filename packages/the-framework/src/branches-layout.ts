import { join } from 'node:path'
import { nodeGitRunner, type GitRunner } from './project.js'
import { FRAMEWORK_DIR, BRANCHES_DIR, LEGACY_WORKTREES_DIR, isSafeAgentId, readLiveMeta } from './store/index.js'
import { worktreeDirName } from './branch-names.js'
import { errorMessage } from './error-message.js'

// The flat branches layout (#1580): every agent worktree lives at
// `.the-framework/branches/<run branch name>`, and the repo root gets a `branches` symlink
// pointing there, so `cd branches/<name>` reaches any session's checkout by the name the
// dashboard shows. #1581 (slash-free branch names) is what lets a dir be named as its branch.
//
// This module is the transition: worktrees created before #1580 sit at
// `.the-framework/worktrees/<agentId>`, where nothing looks anymore. The daemon runs this pass on
// its clock — idempotent and cheap once there is nothing left to do — moving each leftover with
// `git worktree move` (a plain rename would strand git's worktree metadata). Conservative like the
// other sweeps: a checkout whose agent is still running, or whose move fails, simply stays for the
// next pass.

/** The filesystem the layout pass needs beyond git; `node:fs/promises` in production. */
export interface LayoutFs {
  /** Names under `dir`; a missing dir yields `[]`. */
  readdir(dir: string): Promise<string[]>
  /** Recursive mkdir. */
  mkdir(dir: string): Promise<void>
  /** Create a symlink at `path` pointing to `target`. */
  symlink(target: string, path: string): Promise<void>
  /** Whether anything (file, dir, or dangling link) sits at `path`. */
  lexists(path: string): Promise<boolean>
  /** Remove `dir` only if empty; failure is fine. */
  rmdir(dir: string): Promise<void>
}

/** A {@link LayoutFs} over `node:fs/promises`, dynamically imported like {@link nodeDirLister}. */
export function nodeLayoutFs(): LayoutFs {
  const fs = () => import('node:fs/promises')
  return {
    readdir: dir => fs().then(f => f.readdir(dir)).catch(() => []),
    mkdir: dir => fs().then(f => f.mkdir(dir, { recursive: true })).then(() => {}),
    symlink: (target, path) => fs().then(f => f.symlink(target, path)),
    lexists: path => fs().then(f => f.lstat(path)).then(() => true, () => false),
    rmdir: dir => fs().then(f => f.rmdir(dir)).catch(() => {}),
  }
}

/** Injectable seams for {@link ensureBranchesLayout}. */
export interface BranchesLayoutDeps {
  git?: GitRunner
  fs?: LayoutFs
  /** Whether the worktree at `path` still hosts a running agent (default {@link readLiveMeta}). */
  isLive?: (path: string) => Promise<boolean>
}

/**
 * Bring one project onto the #1580 layout: the `branches/` root, the repo-root symlink, and every
 * pre-#1580 worktree moved under it. Returns log lines for what it moved or kept; an already
 * settled project returns `[]`. Never throws.
 */
export async function ensureBranchesLayout(cwd: string, deps: BranchesLayoutDeps = {}): Promise<string[]> {
  const git = deps.git ?? nodeGitRunner()
  const fs = deps.fs ?? nodeLayoutFs()
  const isLive =
    deps.isLive ?? (async (path: string) => (await readLiveMeta(path).catch(() => undefined))?.status === 'running')
  const lines: string[] = []

  const newRoot = join(cwd, FRAMEWORK_DIR, BRANCHES_DIR)
  const oldRoot = join(cwd, FRAMEWORK_DIR, LEGACY_WORKTREES_DIR)

  for (const name of await fs.readdir(oldRoot)) {
    if (!isSafeAgentId(name)) continue
    const from = join(oldRoot, name)
    // A running agent's checkout is where its agent is working: its recorded cwd, its child
    // processes' spawn paths. Moving it out from under them breaks the run; leave it for a pass
    // that finds it ended.
    if (await isLive(from)) continue
    try {
      await fs.mkdir(newRoot)
      await git(['worktree', 'move', from, join(newRoot, worktreeDirName(name))], cwd)
      lines.push(`[framework] moved the worktree for session ${name} to ${BRANCHES_DIR}/${worktreeDirName(name)} (#1580)`)
    } catch (err) {
      lines.push(`[framework] kept the worktree for session ${name} at its pre-#1580 path: ${errorMessage(err)}`)
    }
  }
  // Gone once its last worktree moved; rmdir refuses a non-empty dir, which is the point.
  await fs.rmdir(oldRoot).catch(() => {})

  // The repo-root `branches` symlink (#1580). Relative, so a checkout that moves keeps working;
  // created only when nothing sits at that path — a user's own `branches` file or dir is theirs.
  const link = join(cwd, 'branches')
  if (!(await fs.lexists(link))) {
    try {
      await fs.mkdir(newRoot)
      await fs.symlink(join(FRAMEWORK_DIR, BRANCHES_DIR), link)
      lines.push(`[framework] linked ${link} -> ${FRAMEWORK_DIR}/${BRANCHES_DIR} (#1580)`)
    } catch {
      // A filesystem that refuses symlinks loses the shortcut, nothing else.
    }
  }
  return lines
}

/** A running layout pass, in the shape the daemon's other background services use. */
export interface BranchesLayoutPass {
  /** Run one pass now, awaiting it. */
  tick: () => Promise<void>
  stop: () => void
}

/** What {@link startBranchesLayoutPass} needs from the daemon. */
export interface BranchesLayoutOptions {
  projects: () => Promise<readonly { path: string }[]>
  log: (message: string) => void
  /** The per-project pass (default {@link ensureBranchesLayout}). */
  ensure?: (cwd: string) => Promise<string[]>
}

/**
 * Keep every registered project on the #1580 layout, one turn per call. Runs on the daemon's
 * clock like the other sweeps; the first tick after an upgrade is the one that migrates, and
 * every later tick only re-checks the symlink.
 */
export function startBranchesLayoutPass(opts: BranchesLayoutOptions): BranchesLayoutPass {
  const ensure = opts.ensure ?? ensureBranchesLayout
  let stopped = false

  const passAll = async (): Promise<void> => {
    for (const project of await opts.projects().catch(() => [])) {
      if (stopped) break
      for (const line of await ensure(project.path).catch((): string[] => [])) opts.log(line)
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
