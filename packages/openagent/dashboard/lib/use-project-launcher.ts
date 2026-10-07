import { onCommands, type ProjectLauncher } from '../rpc/projects.js'
import { useLoaded } from './use-async.js'

/**
 * What the launcher offers for a project: its commands, and whether it has a start hook. `null`
 * until it is read, and for no project: a surface says "no start hook" only once it knows.
 */
export function useProjectLauncher(projectId: string | null): ProjectLauncher | null {
  return useLoaded<ProjectLauncher | null>(projectId ? () => onCommands(projectId) : null, null, [projectId])
}
