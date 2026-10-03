import { isDriverName, type DriverName } from './driver-names.js'

/**
 * The person's subagent settings (#1902), node-free so the daemon and the dashboard bundle share
 * one copy: the coding agent and model a main agent's subagents run on, by how hard their task is,
 * and how many of one main agent's subagents run at once. They are the orchestration package's, in
 * its file at each project's root, written through each project's `subagents` line; the dashboard
 * reads the file by its name and runs no tool. A level left out runs on the main agent's own coding
 * agent and model, and a limit left out is the package's own, {@link DEFAULT_AT_ONCE}.
 */

/** The file the settings are kept in, at a project's root; this machine's, hidden from git by the package. */
export const SUBAGENT_SETTINGS_FILE = '.orchestration/settings.json'

/** How many of one main agent's subagents run at once when nobody said: the orchestration package's default. */
export const DEFAULT_AT_ONCE = 4

/** A coding agent and, when one is picked, its model; no model is that coding agent's own default. */
export interface SubagentRunner {
  driver: DriverName
  model?: string
}

export interface SubagentSettings {
  simple?: SubagentRunner
  hard?: SubagentRunner
  atOnce?: number
}

export const SUBAGENT_LEVELS = ['simple', 'hard'] as const

/** The settings in `value`, each field kept only when it has the shape the file promises. */
export function subagentSettingsIn(value: unknown): SubagentSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const given = value as Record<string, unknown>
  const settings: SubagentSettings = {}
  for (const level of SUBAGENT_LEVELS) {
    const runner = given[level]
    if (!runner || typeof runner !== 'object') continue
    const { driver, model } = runner as Record<string, unknown>
    if (typeof driver !== 'string' || !isDriverName(driver)) continue
    settings[level] = { driver, ...(typeof model === 'string' && model.trim() ? { model: model.trim() } : {}) }
  }
  const atOnce = given['atOnce']
  if (typeof atOnce === 'number' && Number.isInteger(atOnce) && atOnce >= 1) settings.atOnce = atOnce
  return settings
}
