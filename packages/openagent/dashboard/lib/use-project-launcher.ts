import { onCommands, type ProjectLauncher } from '../rpc/projects.js'
import { usePolled } from './use-async.js'

/**
 * What the launcher offers for a project: its commands, and whether it has a start hook. `null`
 * until it is read, and for no project: a surface says "no start hook" only once it knows. Read
 * again every few seconds: a skill written into the project's folder, here or in a terminal, is a
 * command from then on, and one that reached the branch agents start from stops waiting.
 */
export function useProjectLauncher(projectId: string | null): ProjectLauncher | null {
  return usePolled<ProjectLauncher | null>(projectId ? () => onCommands(projectId) : null, null, 15_000, [projectId], 'previous').value
}
