import { lstat, mkdir, symlink } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { excludeFromGit, nodeGitRunner, type GitRunner } from '@openagt/agent-data'
import { CLI_BIN_DIR } from './bin-dir.js'

/**
 * This package's command, linked into a checkout that has none: the package itself at
 * `node_modules/@openagt/skill-branches`, and its command at `node_modules/.bin/branches`.
 *
 * The skill tells the agent to run `npx @openagt/skill-branches@^1`. `npx` runs a copy it finds
 * in the checkout, and asks npm for one otherwise. In a project that depends on this package the
 * checkout already has both, linked with the project's other tools. In a project with nothing
 * installed (an empty folder a dashboard added) it has neither, so both are linked here: the
 * agent then runs the very copy that made its checkout, with nothing downloaded and no network.
 *
 * Hidden from the project's git through the repository's exclude file, like the skill's link: a
 * link is the package's state, not the agent's work. Best-effort: an entry already there (the
 * project's own copy) is left alone, and a link that cannot be made is a worse run, not a failed
 * one.
 */

/** The command's name, and where a checkout holds its tools. */
export const COMMAND = 'branches'
const BIN_DIR = 'node_modules/.bin'

/** This package's directory, the one holding its `package.json`: beside `bin/`. */
const PACKAGE_DIR = dirname(CLI_BIN_DIR)

/** The two links, each a path in a checkout and what it points at; the paths are also what the exclude file hides. */
const LINKS: readonly { path: string; target: string; dir?: true }[] = [
  { path: 'node_modules/@openagt/skill-branches', target: PACKAGE_DIR, dir: true },
  { path: `${BIN_DIR}/${COMMAND}`, target: join(CLI_BIN_DIR, COMMAND) },
]

/** The paths of the links, relative to a checkout: the rules a cleanup lifts. */
export const COMMAND_LINKS: readonly string[] = LINKS.map(link => link.path)

export async function linkOwnCommand(repo: string, checkout: string, git: GitRunner = nodeGitRunner()): Promise<void> {
  for (const { path, target, dir } of LINKS) {
    const link = join(checkout, path)
    // lstat, not stat: a link that is there counts, whatever it points at.
    if (await lstat(link).then(() => true, () => false)) continue
    await excludeFromGit(repo, `/${path}`, undefined, git).catch(() => {})
    try {
      await mkdir(dirname(link), { recursive: true })
      // 'junction' is the only directory-link type Windows grants without elevation; it is ignored on POSIX.
      await symlink(target, link, dir ? (process.platform === 'win32' ? 'junction' : 'dir') : 'file')
    } catch {
      // A filesystem that refuses the link: the agent still starts.
    }
  }
}
