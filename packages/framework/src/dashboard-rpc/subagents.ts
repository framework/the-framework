import { contextProjects } from './context.js'
import { readSubagentSettings, setSubagentSettings, type SubagentSettingsView } from '../dashboard/subagent-settings.js'
import type { SubagentSettings } from '../subagent-settings.js'

// Settings → Subagents (#1902): the person's subagent settings, the same on every registered
// project. The work over the projects is in `dashboard/subagent-settings.ts`.

/** The settings in force, and how many projects have the line that writes them. */
export async function onSubagentSettings(): Promise<SubagentSettingsView> {
  return readSubagentSettings(await contextProjects().list().catch(() => []))
}

/** Save the settings whole, through every registered project's `subagents` line. */
export async function sendSubagentSettings(settings: SubagentSettings): Promise<{ ok: true } | { ok: false; error: string }> {
  return setSubagentSettings(await contextProjects().list().catch(() => []), settings)
}
