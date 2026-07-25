import { join } from 'node:path'
import { THE_FRAMEWORK_DIR } from './framework-dir.js'
import { gitignorePath, LOGS_GITIGNORE } from './logs.js'
import { nodeStoreFs, SESSIONS_DIR, type StoreFs } from './store/index.js'
import { nodeGitRunner, type GitRunner } from './project.js'

/**
 * Committed session history (#1179): where a project's finished runs are archived so they survive
 * the repo being cleaned.
 *
 * The bug this exists for: run state was written to `.the-framework/runs/`, which the install-time
 * `.gitignore` keeps untracked, so `git clean -fdx` — an ordinary thing to do to a repo — deleted
 * every session a project had ever run. Nothing was recoverable, because nothing had ever been
 * committed.
 *
 * Scoped per user, as `.the-framework/<user>/sessions/`, rather than one shared directory. Two
 * people working the same repo would otherwise write the same paths from different machines and
 * conflict on every merge; under their own directory their histories simply sit side by side. The
 * list being visible to the whole team is the intended outcome, not a leak — see the issue.
 *
 * The identity is the git `user.email` already configured in the repo, so there is nothing new to
 * set up and the directory matches the name on the commits.
 */

/** The directory, under a user's own directory, that holds their archived runs. */
export { SESSIONS_DIR }

/** Where a run's history goes when git has no identity configured. */
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

/** The `.the-framework/<user>/sessions` directory under a project root. */
export function sessionsDir(cwd: string, user: string): string {
  return join(cwd, THE_FRAMEWORK_DIR, user, SESSIONS_DIR)
}

/**
 * The `.the-framework/.gitignore` rules that make one user's sessions tracked. Three lines, not
 * one: the seeded allow-list ignores everything with `*`, and git never descends into an ignored
 * directory, so each directory on the way down has to be re-included before the files under it can
 * be. Same shape as the conversations rules (#908), which this sits beside.
 */
export function sessionsGitignore(user: string): string {
  return `!${user}/\n!${user}/${SESSIONS_DIR}/\n!${user}/${SESSIONS_DIR}/**\n`
}

/**
 * Make sure `.the-framework/.gitignore` un-ignores this user's sessions, returning whether it
 * wrote. Done lazily on archive rather than at install time: the ignore file is seeded once and
 * only when absent, so every repo activated before this feature carries the old allow-list — and a
 * second person joining a repo needs their own rules added to a file that already exists.
 *
 * Only a file we recognize is upgraded; anything hand-edited beyond recognition is left alone
 * rather than appended to.
 */
export async function ensureSessionsIgnored(cwd: string, user: string, fs: StoreFs = nodeStoreFs()): Promise<boolean> {
  const path = gitignorePath(cwd)
  const rules = sessionsGitignore(user)
  if (!(await fs.exists(path))) {
    await fs.write(path, LOGS_GITIGNORE + rules)
    return true
  }
  const current = await fs.read(path)
  if (current.includes(`!${user}/${SESSIONS_DIR}/**`)) return false
  if (!current.includes('!LOGS.md')) return false
  await fs.write(path, current.endsWith('\n') ? current + rules : current + '\n' + rules)
  return true
}

/**
 * The directory name for the identity this repo commits under, from `git config user.email`.
 *
 * Cached per repo for the process's life: it is read on every archive, it changes about as often
 * as a git identity does, and a run that outlived a config change would only mean the next run
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
