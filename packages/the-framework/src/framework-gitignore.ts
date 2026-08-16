import { join } from 'node:path'
import { THE_FRAMEWORK_DIR } from './framework-dir.js'
import { ARCHIVE_DIR, LEGACY_ARCHIVE_DIR } from './store/index.js'

/**
 * The `.the-framework/.gitignore` (#313/#1179): one file, one content, written at install.
 *
 * Agent state is transient — `events.jsonl`, `agent.json`, `agents/`, the worktrees — and would
 * otherwise turn every session into a dirty checkout. The one thing under here that is committed
 * is the session archive (#1179), because `git clean -fdx` is an ordinary thing to do to a repo
 * and it used to delete every session a project had ever run.
 *
 * An allow-list: `*` ignores everything, and each directory on the way down has to be re-included
 * before the files under it can be, since git never descends into an ignored directory.
 *
 * It grew a rule per record while there were several (B3): `LOGS.md`, then the conversations
 * directory, then the sessions — each added lazily by whichever feature needed it, each with its
 * own "is this a file we wrote" check so a hand-edited one was left alone. With one record left
 * there is one content, so the file is written once and the only question left is whether it is
 * already there.
 */

/** The `.gitignore` path under `cwd`'s `.the-framework/`. */
export function gitignorePath(cwd: string): string {
  return join(cwd, THE_FRAMEWORK_DIR, '.gitignore')
}

/**
 * The archive rules, user-agnostic (#1312).
 *
 * Naming each user meant every person who ever ran an agent in the repo appended their own lines
 * to a *tracked* file: their checkout went dirty, the next safety commit swept the edit into a
 * branch, and two machines doing it near each other conflicted. A glob covers everyone, including
 * people who have not run anything yet.
 *
 * A star matches one path segment and never a slash, so this reaches exactly `<user>/agents/`
 * and not `worktrees/<agent>/agents/`. The transient siblings stay ignored either way: un-ignoring
 * a directory only lets git descend into it, and the bare `*` still ignores every file it finds.
 *
 * Both spellings are un-ignored: D5 renamed the directory, and a repo carrying archives under the
 * old `sessions/` name would otherwise have them ignored the moment this file is rewritten — still
 * tracked, since git does not un-track what it already knows, but invisible to every later add.
 */
export function archiveGitignore(): string {
  const rules = (name: string) => `!*/${name}/\n!*/${name}/**\n`
  return `!*/\n${rules(ARCHIVE_DIR)}${rules(LEGACY_ARCHIVE_DIR)}`
}

/** The whole file: ignore the transient state, keep the session archive. */
export function frameworkGitignore(): string {
  return `# The Framework: session state is transient; the session archive is committed.\n*\n!.gitignore\n${archiveGitignore()}`
}

/** The rule whose presence means the file already un-ignores the session archive. */
export const SESSIONS_RULE = `!*/${ARCHIVE_DIR}/**`
