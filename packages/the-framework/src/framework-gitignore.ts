import { join } from 'node:path'
import { THE_FRAMEWORK_DIR } from './framework-dir.js'
import { LAYOUT_FILE } from './layout.js'

/**
 * The `.the-framework/.gitignore` (#313): one file, one content, written at install.
 *
 * Everything under `.the-framework/` is transient on main — `events.jsonl`, `agent.json`, the
 * worktrees — and would otherwise turn every session into a dirty checkout. The lasting records
 * (the session archives) live on the data branch (#1582), so the only tracked entry left is the
 * layout marker (#1575): main is 100% code plus that one gate file.
 */

/** The `.gitignore` path under `cwd`'s `.the-framework/`. */
export function gitignorePath(cwd: string): string {
  return join(cwd, THE_FRAMEWORK_DIR, '.gitignore')
}

/** The whole file: everything under `.the-framework/` is transient except the layout marker (#1582, #1575). */
export function frameworkGitignore(): string {
  return `# The Framework: agent state is transient; the lasting records live on the the-framework_data branch.\n*\n!.gitignore\n!${LAYOUT_FILE}\n`
}
