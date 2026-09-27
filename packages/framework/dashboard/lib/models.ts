import { useLoaded } from './use-async.js'
import { onModels, type DriverModels, type ModelsView } from '../rpc/models.js'

// Which models each coding agent offers, as the daemon asked the agents themselves. The daemon
// asks once and keeps the answer, so every surface that names a model reads it freely.

/** The models each coding agent offers, `undefined` until the daemon has answered. */
export function useModels(): ModelsView | undefined {
  return useLoaded<ModelsView | undefined>(onModels, undefined, [])
}

/**
 * A model's name as its agent shows it ("Opus 5.5" for `opus`). A model the agent does not list,
 * or a list not answered yet, is named by the id itself: that is what the run was given.
 */
export function modelName(models: DriverModels | undefined, id: string): string {
  return models?.models.find(m => m.id === id)?.name ?? id
}

export type { DriverModels, ModelsView }
