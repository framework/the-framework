import { projectQueue } from './queue.js'
import { projectRuns } from './runs.js'
import { projectTickets } from './tickets.js'

/**
 * A package's command just ran in the project at `root` (a widget's, through the dashboard), and
 * may have written what one of the framework's provided readers caches: every provided reader
 * forgets that project, so its next read runs the provider again. The framework never knows which
 * command writes what; forgetting is cheap and re-reading is what it does anyway.
 */
export function providedDataChanged(root: string): void {
  projectQueue.changed(root)
  projectRuns.changed(root)
  projectTickets.changed(root)
}
