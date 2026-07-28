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
 * The `.the-framework/.gitignore` rules that make every user's sessions tracked. Three lines, not
 * one: the seeded allow-list ignores everything with `*`, and git never descends into an ignored
 * directory, so each directory on the way down has to be re-included before the files under it can
 * be. Same shape as the conversations rules (#908), which this sits beside.
 *
 * User-agnostic on purpose (#1312). Naming each user meant every person who ever ran a session in
 * the repo appended their own three lines to a *tracked* file: their checkout went dirty, the next
 * safety commit swept the edit into a branch, and two machines doing it near each other conflicted.
 * A glob covers everyone, including people who have not run anything yet, so the file is written
 * once and then never again.
 *
 * A star matches one path segment and never a slash, so the sessions rule reaches exactly
 * `<user>/sessions/` and not `worktrees/<run>/sessions/`. The transient siblings stay ignored
 * either way: un-ignoring a directory only lets git descend into it, and the bare `*` still
 * ignores every file it finds there.
 */
export function sessionsGitignore(): string {
  return `!*/\n!*/${SESSIONS_DIR}/\n!*/${SESSIONS_DIR}/**\n`
}

/** The glob rule whose presence means a file is already on the #1312 form. */
const GLOB_RULE = `!*/${SESSIONS_DIR}/**`

/** `!<user>/`, `!<user>/sessions/` and `!<user>/sessions/**` for one named user. */
function perUserRules(user: string): readonly string[] {
  return [`!${user}/`, `!${user}/${SESSIONS_DIR}/`, `!${user}/${SESSIONS_DIR}/**`]
}

/**
 * Drop the per-user session rules, keeping every other line.
 *
 * Only users the file actually names a `sessions` rule for are stripped, and only those three
 * exact lines. The conversations rules (#908) are a literal directory name rather than a user, so
 * they never match, and a hand-written rule this does not recognize is left where it is.
 */
export function withoutPerUserRules(md: string): string {
  const lines = md.split('\n')
  const users = lines
    .map(line => /^!(.+)\/sessions\/\*\*$/.exec(line.trim())?.[1])
    .filter((user): user is string => user !== undefined && user !== '*')
  if (!users.length) return md
  const drop = new Set(users.flatMap(perUserRules))
  return lines.filter(line => !drop.has(line.trim())).join('\n')
}

/**
 * Make sure `.the-framework/.gitignore` un-ignores archived sessions, returning whether it wrote.
 * Done lazily on archive rather than at install time: the ignore file is seeded once and only when
 * absent, so every repo activated before this feature carries the old allow-list.
 *
 * Writes at most twice in a repo's life, and usually once: a file already on the glob form is left
 * alone, and a file still naming users is upgraded to the glob form in place — the per-user lines
 * come out in the same write that puts the glob in, so the churn (#1312) ends rather than being
 * added to. `user` no longer selects the rules; it stays because the caller has it and a future
 * rule may need it again.
 *
 * Only a file we recognize is touched; anything hand-edited beyond recognition is left alone.
 */
export async function ensureSessionsIgnored(cwd: string, _user: string, fs: StoreFs = nodeStoreFs()): Promise<boolean> {
  const path = gitignorePath(cwd)
  const rules = sessionsGitignore()
  if (!(await fs.exists(path))) {
    await fs.write(path, LOGS_GITIGNORE + rules)
    return true
  }
  const current = await fs.read(path)
  if (current.includes(GLOB_RULE)) return false
  if (!current.includes('!LOGS.md')) return false
  const pruned = withoutPerUserRules(current)
  await fs.write(path, pruned.endsWith('\n') ? pruned + rules : pruned + '\n' + rules)
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
