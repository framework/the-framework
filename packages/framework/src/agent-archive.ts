import { ARCHIVE_DIR } from './store/index.js'
import { nodeGitRunner, type GitRunner } from '@better-skills/branch-management'
/**
 * Committed session history (#1179): where a project's finished agents are archived so they survive
 * the repo being cleaned.
 *
 * The bug this exists for: agent state was written to `.the-framework/agents/`, which the install-time
 * `.gitignore` keeps untracked, so `git clean -fdx` — an ordinary thing to do to a repo — deleted
 * every session a project had ever run. Nothing was recoverable, because nothing had ever been
 * committed. Since #1582 the lasting copy lives on the data branch, as `agents/<user>/`.
 *
 * Scoped per user rather than one shared directory. Two people working the same repo would
 * otherwise write the same paths from different machines and conflict on every merge; under their
 * own directory their histories simply sit side by side. The list being visible to the whole team
 * is the intended outcome, not a leak — see the issue.
 *
 * The identity is the git `user.email` already configured in the repo, so there is nothing new to
 * set up and the directory matches the name on the commits.
 */

/** The directory, under a user's own directory, that holds their archived agents. */
export { ARCHIVE_DIR }

/** Where an agent's history goes when git has no identity configured. */
export const ANONYMOUS_USER_DIR = 'anonymous'

/**
 * Longest directory name we will make from an email. Well past any real address, and short enough
 * that the archive paths under it stay inside the path limits of every platform we run on.
 */
const MAX_USER_DIR = 64

/**
 * An email as a directory name: lowercased, with anything outside a conservative set replaced by
 * `-`. The result must start with a letter or digit, which is what rules out `.`, `..` and dotfile
 * names — this value comes from repo configuration and is joined onto a path, so a name that could
 * climb out of the directory is the one thing that must be impossible. Anything that cannot be made
 * to fit falls back to {@link ANONYMOUS_USER_DIR} rather than to a guess.
 */
export function userDirName(email: string | undefined): string {
  const cleaned = (email ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9@._+-]/g, '-')
  return cleaned.length > 0 && cleaned.length <= MAX_USER_DIR && /^[a-z0-9][a-z0-9@._+-]*$/.test(cleaned)
    ? cleaned
    : ANONYMOUS_USER_DIR
}

/**
 * The directory name for the identity this repo commits under, from `git config user.email`.
 *
 * Cached per repo for the process's life: it is read on every archive, it changes about as often
 * as a git identity does, and an agent that outlived a config change would only mean the next agent
 * files itself correctly. A missing or unreadable identity yields {@link ANONYMOUS_USER_DIR}, so
 * history is still kept — filing it under a placeholder is strictly better than dropping it.
 */
const cache = new Map<string, string>()

export async function resolveUserDir(cwd: string, git: GitRunner = nodeGitRunner()): Promise<string> {
  const hit = cache.get(cwd)
  if (hit !== undefined) return hit
  const email = await git(['config', 'user.email'], cwd).catch(() => '')
  const dir = userDirName(email.trim())
  cache.set(cwd, dir)
  return dir
}

/** Drop the {@link resolveUserDir} cache. For tests, and for a daemon that outlives a config change. */
export function forgetUserDirs(): void {
  cache.clear()
}
