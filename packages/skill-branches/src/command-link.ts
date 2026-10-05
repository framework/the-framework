import { lstat, mkdir, symlink } from 'node:fs/promises'
import { join } from 'node:path'
import { excludeFromGit, nodeGitRunner, type GitRunner } from '@openagt/agent-data'
import { CLI_BIN_DIR } from './bin-dir.js'

/**
 * This package's command, linked into a checkout that has none: `node_modules/.bin/branches`.
 *
 * The skill tells the agent to run `npx branches`. In a project that depends on this package the
 * checkout already has the command, linked with the project's other tools. In a project with
 * nothing installed (an empty folder a dashboard added) it has none, and `npx` then downloads
 * whatever package holds the name `branches` on npm and runs it: a stranger's code, in the
 * person's project. With the command linked here `npx` finds it in the checkout and downloads
 * nothing.
 *
 * Hidden from the project's git through the repository's exclude file, like the skill's link: the
 * link is the package's state, not the agent's work. Best-effort: a command already there (the
 * project's own copy) is left alone, and a link that cannot be made is a worse run, not a failed
 * one.
 */

/** The command's name, and where a checkout holds its tools. */
export const COMMAND = 'branches'
const BIN_DIR = 'node_modules/.bin'

export async function linkOwnCommand(repo: string, checkout: string, git: GitRunner = nodeGitRunner()): Promise<void> {
  const link = join(checkout, BIN_DIR, COMMAND)
  // lstat, not stat: a link that is there counts, whatever it points at.
  if (await lstat(link).then(() => true, () => false)) return
  await excludeFromGit(repo, `/${BIN_DIR}/${COMMAND}`, undefined, git).catch(() => {})
  try {
    await mkdir(join(checkout, BIN_DIR), { recursive: true })
    await symlink(join(CLI_BIN_DIR, COMMAND), link)
  } catch {
    // A filesystem that refuses the link: the agent still starts.
  }
}
