import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { nodeGitRunner, removeOwnDirectory, type GitRunner, type KeptEntry } from '@openagt/agent-data'
import { SETTINGS_DIR, SETTINGS_FILE } from './settings.js'

/**
 * `cleanup`: what this package left in a project, removed, for a person who takes the project out
 * of a dashboard and asks for the tools' files to go too. The package removes its own and nothing
 * else: a dashboard asks for it by the `cleanup` kind the package declares under `openagent` in
 * its package.json, and holds no list of this package's files.
 *
 * What goes is the settings file, and the half-written one a save that was killed left beside it,
 * then their directory once it is empty, then the rule hiding the directory from git
 * (`removeOwnDirectory`). The plans and the subagents' records are on the records' branch, and a
 * landed subagent's last commit under `refs/landed/`: none of them is this package's to remove.
 */

export interface CleanupOutcome {
  ok: true
  removed: string[]
  kept: KeptEntry[]
}

/** The file `writeSettings` writes before it renames it into place: `settings.json.<pid>.<uuid>`. */
const HALF_WRITTEN = /^settings\.json\.\d+\.[0-9a-f-]{36}$/

export async function cleanup(repo: string, git: GitRunner = nodeGitRunner()): Promise<CleanupOutcome> {
  const halfWritten = (await readdir(join(repo, SETTINGS_DIR)).catch((): string[] => [])).filter(name => HALF_WRITTEN.test(name))
  return { ok: true, ...(await removeOwnDirectory(repo, SETTINGS_DIR, [SETTINGS_FILE, ...halfWritten], 'orchestration', git)) }
}
