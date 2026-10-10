import { lstat, mkdir, realpath, symlink } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { excludeFromGit, nodeGitRunner, type GitRunner } from '@openagt/agent-data'
import { CLI_BIN_DIR } from './bin-dir.js'

/**
 * This package's command, linked into a checkout that has none: its command at
 * `node_modules/.bin/branches`, and the package itself at `node_modules/@openagt/skill-branches`.
 *
 * The skill tells the agent to run `npx @openagt/skill-branches@0.1`. `npx` looks for a copy of
 * the package in the checkout, and asks npm for one otherwise; a copy it finds, it runs by the
 * command's name from `node_modules/.bin`. In a project that depends on this package the checkout
 * already has both, linked with the project's other tools. In a project with nothing installed (an
 * empty folder a dashboard added) it has neither, so both are linked here: the agent then runs the
 * very copy that made its checkout, with nothing downloaded and no network.
 *
 * The package is linked only beside this package's own command. Beside another tool that holds the
 * name `branches` in the project, the full name would run that tool, so there it is left to npm.
 *
 * Hidden from the project's git through the repository's exclude file, like the skill's link: a
 * link is the package's state, not the agent's work. Best-effort: an entry already there (the
 * project's own copy) is left alone, and a link that cannot be made is a worse run, not a failed
 * one.
 */

/** The command's name, where a checkout holds its tools, and where it holds this package. */
const COMMAND = 'branches'
const COMMAND_LINK = `node_modules/.bin/${COMMAND}`
const PACKAGE_LINK = 'node_modules/@openagt/skill-branches'

/** The command's script, and this package's directory, the one holding its `package.json`: beside `bin/`. */
const COMMAND_FILE = join(CLI_BIN_DIR, COMMAND)
const PACKAGE_DIR = dirname(CLI_BIN_DIR)

/** The paths of the links, relative to a checkout: what the exclude file hides, and the rules a cleanup lifts. */
export const COMMAND_LINKS: readonly string[] = [COMMAND_LINK, PACKAGE_LINK]

export async function linkOwnCommand(repo: string, checkout: string, git: GitRunner = nodeGitRunner()): Promise<void> {
  const command = join(checkout, COMMAND_LINK)
  if (!(await entryExists(command))) await link(repo, checkout, COMMAND_LINK, COMMAND_FILE, 'file', git)
  const ours = await realpath(command).then(async path => path === (await realpath(COMMAND_FILE)), () => false)
  // 'junction' is the only directory-link type Windows grants without elevation; it is ignored on POSIX.
  if (ours && !(await entryExists(join(checkout, PACKAGE_LINK)))) await link(repo, checkout, PACKAGE_LINK, PACKAGE_DIR, process.platform === 'win32' ? 'junction' : 'dir', git)
}

/** lstat, not stat: a link that is there counts, whatever it points at. */
function entryExists(path: string): Promise<boolean> {
  return lstat(path).then(() => true, () => false)
}

async function link(repo: string, checkout: string, path: string, target: string, type: 'file' | 'dir' | 'junction', git: GitRunner): Promise<void> {
  await excludeFromGit(repo, `/${path}`, undefined, git).catch(() => {})
  try {
    await mkdir(dirname(join(checkout, path)), { recursive: true })
    await symlink(target, join(checkout, path), type)
  } catch {
    // A filesystem that refuses the link: the agent still starts.
  }
}
