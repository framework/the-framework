import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { readProjectHooks, runSubagentsHook } from '../project-hooks.js'
import { SUBAGENT_SETTINGS_FILE, subagentSettingsIn, type SubagentSettings } from '../subagent-settings.js'
import type { ProjectSummary } from './projects.js'

// Settings → Subagents (#1902) over the projects given: read off the projects' files by name,
// written through every project's `subagents` line, as the spend offset is through `offset`. The
// daemon names no tool.

/** The settings in force, and how many projects have the line that writes them. */
export interface SubagentSettingsView {
  settings: SubagentSettings
  /** Projects with a `subagents` line; none means Settings can save nothing. */
  hooked: number
}

/**
 * The settings of the first project, in registry order, that has the line and a file: Settings
 * writes every project alike, so they differ only where a file was edited by hand.
 */
export async function readSubagentSettings(projects: readonly ProjectSummary[]): Promise<SubagentSettingsView> {
  let settings: SubagentSettings | undefined
  let hooked = 0
  for (const project of projects) {
    if ((await readProjectHooks(project.path)).subagents === undefined) continue
    hooked++
    if (settings !== undefined) continue
    const raw = await readFile(join(project.path, SUBAGENT_SETTINGS_FILE), 'utf8').catch(() => undefined)
    if (raw === undefined) continue
    try {
      settings = subagentSettingsIn(JSON.parse(raw))
    } catch {
      // A file that does not parse is no settings: the next project's may say.
    }
  }
  return { settings: settings ?? {}, hooked }
}

/**
 * Save the settings whole, through the `subagents` line of each project given. Only settings of the
 * promised shape are passed on. A project without the line is skipped; none having it, or a line
 * that fails, is the answer's error, each failing project named.
 */
export async function setSubagentSettings(
  projects: readonly ProjectSummary[],
  settings: SubagentSettings,
  run: typeof runSubagentsHook = runSubagentsHook,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const clean = subagentSettingsIn(settings)
  let hooked = 0
  const failed: string[] = []
  for (const project of projects) {
    const set = await run(project.path, clean)
    if (set.ok) hooked++
    else if (!set.noHook) failed.push(`${project.name}: ${set.error}`)
  }
  if (failed.length) return { ok: false, error: failed.join('; ') }
  if (!hooked) return { ok: false, error: 'no project has a subagents hook in .the-framework/hooks.yml' }
  return { ok: true }
}
