import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { excludeFromGit, nodeGitRunner, type GitRunner } from '@gemstack/agent-data'
import { isDriverName } from 'agent-runner'
import { LEVELS, isLevel, type Level, type Runner, type Settings } from './levels.js'

export { DEFAULT_AT_ONCE, LEVELS, isLevel, type Level, type Runner, type Settings } from './levels.js'

/**
 * The person's settings for subagents, on this machine: which coding agent and model a simple
 * task runs on, which a hard one runs on, and how many of one main agent's subagents run at once.
 * One JSON file under `.orchestration/` at the project's root, written by `settings` (the package's
 * Settings section in the dashboard runs it) and read by `start`. Never tracked: the directory is hidden through the
 * repository's exclude file, as the scheduler's state is, since the models are one person's.
 *
 * A level nobody set runs on the main agent's own coding agent and model.
 */

export const SETTINGS_DIR = '.orchestration'
export const SETTINGS_FILE = 'settings.json'

export function settingsPath(repo: string): string {
  return join(repo, SETTINGS_DIR, SETTINGS_FILE)
}

/**
 * The settings as given, or why they are not settings. Strict, since a person's dashboard wrote
 * them: an unknown coding agent or a limit below one is refused, not dropped.
 */
export function parseSettings(value: unknown): { ok: true; settings: Settings } | { ok: false; error: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, error: 'the settings are not a JSON object' }
  const given = value as Record<string, unknown>
  const unknown = Object.keys(given).filter(key => key !== 'atOnce' && !isLevel(key))
  if (unknown.length > 0) return { ok: false, error: `unknown setting ${unknown.join(', ')}` }
  const settings: Settings = {}
  for (const level of LEVELS) {
    const runner = given[level]
    if (runner === undefined || runner === null) continue
    if (typeof runner !== 'object' || Array.isArray(runner)) return { ok: false, error: `${level} is not a coding agent and model` }
    const { driver, model } = runner as Record<string, unknown>
    if (typeof driver !== 'string' || !isDriverName(driver)) return { ok: false, error: `${level}: unknown coding agent ${JSON.stringify(driver)}` }
    if (model !== undefined && (typeof model !== 'string' || !model.trim())) return { ok: false, error: `${level}: the model is not a name` }
    settings[level] = { driver, ...(model !== undefined ? { model: model.trim() } : {}) }
  }
  const atOnce = given['atOnce']
  if (atOnce !== undefined && atOnce !== null) {
    if (typeof atOnce !== 'number' || !Number.isInteger(atOnce) || atOnce < 1) return { ok: false, error: 'atOnce is not a whole number of at least 1' }
    settings.atOnce = atOnce
  }
  return { ok: true, settings }
}

/** The settings as written; none when there is no file, or it does not parse as settings. */
export async function readSettings(repo: string): Promise<Settings> {
  const raw = await readFile(settingsPath(repo), 'utf8').catch(() => undefined)
  if (raw === undefined) return {}
  try {
    const parsed = parseSettings(JSON.parse(raw))
    return parsed.ok ? parsed.settings : {}
  } catch {
    return {}
  }
}

/**
 * Write the settings whole, through a file of its own then a rename, so two writes at once leave
 * one of them whole rather than both mixed. The first write also hides the directory from git;
 * best-effort, as the scheduler's is.
 */
export async function writeSettings(repo: string, settings: Settings, git: GitRunner = nodeGitRunner()): Promise<void> {
  await mkdir(join(repo, SETTINGS_DIR), { recursive: true })
  await excludeFromGit(repo, `/${SETTINGS_DIR}`, undefined, git).catch(() => {})
  const next = `${settingsPath(repo)}.${process.pid}.${randomUUID()}`
  await writeFile(next, JSON.stringify(settings, null, 2) + '\n')
  await rename(next, settingsPath(repo))
}

/**
 * The coding agent and model a task at `level` runs on: the setting for the level, else the main
 * agent's own.
 */
export function runnerFor(settings: Settings, level: Level, main: Runner): Runner {
  return settings[level] ?? main
}
