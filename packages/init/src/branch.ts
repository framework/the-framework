import { lstat } from 'node:fs/promises'
import { join } from 'node:path'
import { nodeGitRunner, type GitRunner } from '@openagt/agent-data'
import { SKILL_NAMES } from './catalogue.js'
import { commitPaths, type CommitOutcome } from './commit.js'
import { LINKS_DIR, TEXTS_DIR } from './project.js'

/**
 * A project's skills as git has them (#2023): which are on a branch, and which stand written or
 * deleted in the folder with no commit yet. An agent's checkout starts from a branch, so a skill
 * written into the folder reaches agents only once it is on that branch; until then a dashboard
 * says it is waiting, and offers the commit.
 */

/** The names of the skills whose text is on `ref`, in either folder: the text itself, or a link there to a text that is. */
export async function skillsOn(root: string, ref: string, git: GitRunner = nodeGitRunner()): Promise<Set<string>> {
  const listed = await git(['ls-tree', '-r', '-z', '--name-only', ref, '--', TEXTS_DIR, LINKS_DIR], root).catch(() => '')
  const paths = new Set(listed.split('\0').filter(Boolean))
  const on = new Set<string>()
  const texts = (dir: string): string[] => [...paths].flatMap(path => (path.startsWith(`${dir}/`) && path.endsWith('/SKILL.md') && path.split('/').length === 4 ? [path.split('/')[2]!] : []))
  for (const name of [...texts(TEXTS_DIR), ...texts(LINKS_DIR)]) on.add(name)
  // A link is one entry of the tree, named as the skill: it counts where the text it leads to is on the branch too.
  for (const path of paths) {
    const [, , name, more] = path.split('/')
    if (path.startsWith(`${LINKS_DIR}/`) && name !== undefined && more === undefined && paths.has(`${TEXTS_DIR}/${name}/SKILL.md`)) on.add(name)
  }
  return on
}

/** The paths git may hold for the skills of `init`'s list, from the project's root: each text, each link, and a text in a folder of Claude Code's own where there is no link. */
async function skillPaths(root: string): Promise<string[]> {
  const paths: string[] = []
  for (const name of SKILL_NAMES) {
    paths.push(`${TEXTS_DIR}/${name}/SKILL.md`)
    // Git takes a link as one path, and refuses a path that goes through one.
    const link = await lstat(join(root, LINKS_DIR, name)).catch(() => undefined)
    paths.push(link?.isDirectory() ? `${LINKS_DIR}/${name}/SKILL.md` : `${LINKS_DIR}/${name}`)
  }
  return paths
}

/** How many skill files stand written, changed or deleted in the folder with no commit yet. */
export async function uncommittedSkills(root: string, git: GitRunner = nodeGitRunner()): Promise<number> {
  const status = await git(['status', '--porcelain', '-z', '-uall', '--', ...(await skillPaths(root))], root).catch(() => '')
  return status.split('\0').filter(Boolean).length
}

/** One commit of every skill file that stands uncommitted, and nothing else: what a dashboard's "Commit" does. Never a push. */
export async function commitSkills(root: string, git: GitRunner = nodeGitRunner()): Promise<CommitOutcome> {
  return commitPaths(root, await skillPaths(root), 'Update OpenAgent skills\n', git)
}
