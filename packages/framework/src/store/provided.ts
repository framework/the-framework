import { lookupProvidedCommand } from '@gemstack/agent-data'
import { projectBranches } from './branches.js'
import { projectGitHost } from './git-host.js'
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
  projectBranches.changed(root)
  projectGitHost.changed(root)
  projectQueue.changed(root)
  projectRuns.changed(root)
  projectTickets.changed(root)
}

/** The kinds of the framework's data a project's package may provide, one reader each (`git-host` is `git-host.ts`). */
export const PROVIDED_KINDS = ['tickets', 'queue', 'runs', 'branches', 'git-host'] as const

/**
 * Why a kind of the project's data has no provider although packages declare it (#1820): two or
 * more declare the kind and the project's package.json names none, or names one that does not
 * declare it. One sentence per such kind, for the project's error banner; none when every kind is
 * settled. Nobody declaring a kind is not a problem: the project has none of that data.
 */
export async function providerProblems(root: string): Promise<string[]> {
  const problems: string[] = []
  for (const kind of PROVIDED_KINDS) {
    const { problem } = await lookupProvidedCommand(root, kind).catch((): { problem?: string } => ({}))
    if (problem) problems.push(problem)
  }
  return problems
}
