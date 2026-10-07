import { contextModels } from './context.js'
import type { ModelsView } from '../dashboard/models.js'

// The agent and model menu's surface: which models each coding agent offers, as the daemon asked
// them. The source is wired into the dashboard context by the daemon.

/** Which models each coding agent offers, or why one could not say. */
export function onModels(): Promise<ModelsView> {
  return contextModels().read()
}
