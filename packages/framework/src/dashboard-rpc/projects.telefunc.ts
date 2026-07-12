import { contextProjects } from './context.js'
import type { ProjectSummary } from '../dashboard/projects.js'

// The Projects sidebar behind the new dashboard (#405): the global registry (#390) the
// daemon and CLI write — id, path, name, activated, last activity. The per-run
// foreground dashboard (#427) scopes this to a single project via the request context.
// The live event stream is its own Telefunc Channel (events.telefunc.ts).
export async function onProjects(): Promise<ProjectSummary[]> {
  return contextProjects().list()
}
