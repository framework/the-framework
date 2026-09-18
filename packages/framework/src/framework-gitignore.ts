import { join } from 'node:path'
import { DATA_BRANCH } from '@gemstack/agent-data/names'
import { THE_FRAMEWORK_DIR } from './framework-dir.js'

/**
 * The `.the-framework/.gitignore` (#313): one file, one content, written at install.
 *
 * Everything under `.the-framework/` is this machine's or transient: a run's live files, the
 * hooks file. The lasting records (the runs, the `logs` skill's) live on the data branch
 * (#1582/#1769), so nothing but this file is tracked: main is 100% code.
 */

/** The `.gitignore` path under `cwd`'s `.the-framework/`. */
export function gitignorePath(cwd: string): string {
  return join(cwd, THE_FRAMEWORK_DIR, '.gitignore')
}

/** The whole file: everything under `.the-framework/` stays out of git (#1582). */
export function frameworkGitignore(): string {
  return `# The Framework: agent state is transient; the lasting records live on the ${DATA_BRANCH} branch.\n*\n!.gitignore\n`
}
