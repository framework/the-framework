import { originDefaultBranch } from '@openagt/agent-data'
import { currentBranch } from './git-status.js'

/**
 * The branch agents start from in the project at `cwd`: origin's default branch as this clone has
 * it, read locally and never fetched, else the branch the folder is on (a project with no remote
 * starts an agent from its last local commit). `ref` is what git is asked, `name` what a person
 * reads. None where the folder is on no branch, or is no repository.
 */
export async function startBranch(cwd: string): Promise<{ ref: string; name: string } | undefined> {
  const main = await originDefaultBranch(cwd).catch(() => undefined)
  if (main !== undefined) return { ref: main, name: main.slice('origin/'.length) }
  const local = await currentBranch(cwd).catch(() => undefined)
  return local !== undefined && local !== 'HEAD' ? { ref: 'HEAD', name: local } : undefined
}
