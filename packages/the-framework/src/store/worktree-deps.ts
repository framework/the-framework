import { join, relative } from 'node:path'
import { nodeFs, type NodeFs } from '../node-fs.js'
import { excludeFromGit } from '../git-exclude.js'
import { nodeGitRunner, type GitRunner } from '../project.js'
import { FRAMEWORK_DIR } from './agent-store.js'

/**
 * Give a fresh worktree a dependency tree (#736). `node_modules` is gitignored, so
 * `git worktree add` hands the agent an empty one and every command in it fails.
 *
 * Three ways to fix that: copy the tree (correct, but gigabytes per agent), install
 * into each worktree (correct, but real latency on every start), or symlink the
 * parent checkout's trees in (instant, no extra disk, one store shared by N runs).
 * We symlink. The one case it is wrong for is an agent that changes the lockfile —
 * that needs its own install regardless, and the agent runs the install itself.
 *
 * Directory symlinks are what make this work in a pnpm workspace: linking
 * `packages/foo/node_modules` as a whole means the `.pnpm` symlinks inside it
 * still resolve against their real location in the parent checkout.
 */

/** The dependency directory mirrored into a worktree. */
const NODE_MODULES = 'node_modules'

/** How deep below the repo root a `node_modules` is looked for (root = 0). Covers a
 *  pnpm/npm workspace's `packages/<pkg>/node_modules` without walking the world. */
const MAX_DEPTH = 2

/** Directory names never descended into while scanning for dependency trees. */
const SKIP = new Set([NODE_MODULES, '.git', FRAMEWORK_DIR, 'dist', 'build', 'coverage'])

/** The filesystem this module needs. Injectable so the scan is testable. */
export interface LinkFs {
  /** Entry names in a directory. A missing/unreadable dir yields `[]`. */
  readdir(path: string): Promise<string[]>
  /** True when `path` is a directory (following symlinks). Any error reads as `false`. */
  isDirectory(path: string): Promise<boolean>
  /** True when anything exists at `path`, symlinks included (no link following). */
  entryExists(path: string): Promise<boolean>
  /** Recursive. */
  mkdir(path: string): Promise<void>
  /** Create a directory symlink at `path` pointing to `target`. */
  symlinkDir(target: string, path: string): Promise<void>
}

/** The `node:fs/promises` implementation of {@link LinkFs}. */
export function nodeLinkFs(): LinkFs {
  return {
    async readdir(path) {
      const { readdir } = await import('node:fs/promises')
      return readdir(path).catch(() => [])
    },
    async isDirectory(path) {
      const { stat } = await import('node:fs/promises')
      return stat(path).then(s => s.isDirectory(), () => false)
    },
    async entryExists(path) {
      const { lstat } = await import('node:fs/promises')
      return lstat(path).then(() => true, () => false)
    },
    async mkdir(path) {
      const { mkdir } = await import('node:fs/promises')
      await mkdir(path, { recursive: true })
    },
    async symlinkDir(target, path) {
      const { symlink } = await import('node:fs/promises')
      // 'junction' is the only directory-link type Windows grants without elevation;
      // it is ignored on POSIX.
      await symlink(target, path, process.platform === 'win32' ? 'junction' : 'dir')
    },
  }
}

/**
 * Every `node_modules` directory in `repo`, as repo-relative paths, down to
 * {@link MAX_DEPTH}. Sorted, so the linking order (and any log of it) is stable.
 */
export async function findDependencyDirs(repo: string, fs: LinkFs = nodeLinkFs()): Promise<string[]> {
  const found: string[] = []
  const walk = async (dir: string, depth: number): Promise<void> => {
    if (await fs.isDirectory(join(dir, NODE_MODULES))) found.push(relative(repo, join(dir, NODE_MODULES)))
    if (depth >= MAX_DEPTH) return
    for (const name of await fs.readdir(dir)) {
      if (name.startsWith('.') || SKIP.has(name)) continue
      const child = join(dir, name)
      if (await fs.isDirectory(child)) await walk(child, depth + 1)
    }
  }
  await walk(repo, 0)
  return found.sort()
}

/**
 * Symlink `repo`'s dependency trees into `worktree` at the same relative paths.
 * Returns the paths linked. Best-effort throughout: a worktree with no deps is a
 * worse run, not a failed one, so a link that cannot be made is skipped rather
 * than thrown. An existing entry is left alone (the agent may have installed already).
 */
export async function linkDependencies(repo: string, worktree: string, fs: LinkFs = nodeLinkFs()): Promise<string[]> {
  const linked: string[] = []
  for (const rel of await findDependencyDirs(repo, fs)) {
    const target = join(repo, rel)
    const link = join(worktree, rel)
    try {
      if (await fs.entryExists(link)) continue
      const parent = join(link, '..')
      if (!(await fs.isDirectory(parent))) await fs.mkdir(parent)
      await fs.symlinkDir(target, link)
      linked.push(rel)
    } catch {
      // Raced, or a filesystem that refuses the link: the agent still starts.
    }
  }
  return linked
}

/** The exclude rule that covers a linked tree. Deliberately slash-free: see below. */
const EXCLUDE_RULE = NODE_MODULES

/**
 * Make git ignore the dependency links (#738). A repo's `.gitignore` says `node_modules/`, and
 * a trailing slash matches a *directory* only — the links {@link linkDependencies} makes are
 * symlinks, so they are not covered, and they show up as untracked in every agent's worktree.
 * That is not cosmetic: the agent runs `git add -A`, so the agent would commit dangling absolute
 * symlinks into its branch and onto the PR.
 *
 * A slash-free `node_modules` in the repo-level exclude ({@link excludeFromGit}) covers the
 * symlink form in every worktree, and the main checkout is unaffected in practice: its
 * `node_modules` is a real directory, already ignored by the same name.
 *
 * Best-effort: an agent whose links are merely untracked is still an agent.
 */
export async function excludeDependencyLinks(
  repo: string,
  fs: NodeFs = nodeFs(),
  agent: GitRunner = nodeGitRunner(),
): Promise<void> {
  try {
    await excludeFromGit(repo, EXCLUDE_RULE, fs, agent)
  } catch {
    // Not a repo, or an unwritable git dir: the links just stay visible to git status.
  }
}
