import { join, isAbsolute } from 'node:path'
import { nodeFs, type NodeFs } from './node-fs.js'
import { nodeGitRunner, type GitRunner } from './project.js'

/**
 * Append one ignore rule to the repository's `info/exclude` — the ignore file that is git's, not
 * the project's, so no tracked file changes and no user ever sees a diff. The rule goes in the
 * *common* git dir because git resolves excludes from there; a per-worktree copy looks right and
 * is silently never read. One rule there covers every worktree of the repo. Idempotent. Throws on
 * a non-repo or unwritable git dir — callers decide whether that is fatal (so far, never).
 */
export async function excludeFromGit(
  repo: string,
  rule: string,
  fs: NodeFs = nodeFs(),
  git: GitRunner = nodeGitRunner(),
): Promise<void> {
  const common = (await git(['rev-parse', '--git-common-dir'], repo)).trim()
  if (!common) return
  const infoDir = join(isAbsolute(common) ? common : join(repo, common), 'info')
  const path = join(infoDir, 'exclude')
  const current = await fs.read(path).catch(() => '')
  if (current.split('\n').some(line => line.trim() === rule)) return
  await fs.mkdir(infoDir)
  await fs.append(path, (current && !current.endsWith('\n') ? '\n' : '') + rule + '\n')
}
