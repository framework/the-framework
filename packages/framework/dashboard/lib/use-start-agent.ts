import type { Preferences } from '../../src/index.js'
import { sendStart } from '../rpc/control.js'
import { useAction } from './use-action.js'

type StartArgs = Parameters<typeof sendStart>

/** The person's picks a start carries to the project's start hook; an unset one is left to the hook's own default. */
export function startPicks(preferences: Preferences): { driver?: string; model?: string } {
  return {
    ...(preferences.driver ? { driver: preferences.driver } : {}),
    ...(preferences.model ? { model: preferences.model } : {}),
  }
}

/** The command the launcher's "Post-merge cleanup" box follows a run with, offered only where the project has it. */
export const POST_MERGE_CLEANUP = 'post-merge-cleanup'

/** Whether the project offers the post-merge cleanup: it has the command. */
export function offersPostMergeCleanup(commands: readonly { name: string }[]): boolean {
  return commands.some(command => command.name === POST_MERGE_CLEANUP)
}

/**
 * The follow-up a launcher start carries: the cleanup command, when the box is ticked and the
 * project has the command. The start hook gets it in `THEN`; the run's tool gives it the run's id.
 */
export function cleanupPick(preferences: Preferences, commands: readonly { name: string }[]): { then?: string } {
  return preferences.postMergeCleanup && offersPostMergeCleanup(commands) ? { then: `/${POST_MERGE_CLEANUP}` } : {}
}

// Starting a run, for every surface that does (the launcher, the tickets' and the queue's
// buttons): the project's start hook answers the new run's id, or says in words why there is
// none, and neither surface hand-rolls the busy/error/finally scaffold useAction owns.
export function useStartAgent(): {
  busy: boolean
  error: string | null
  reset: () => void
  /** Start the run; resolves with its id, or `undefined` (error state set). */
  start: (projectId: string, text: string, options?: StartArgs[2], fallback?: string) => Promise<{ agentId: string } | undefined>
} {
  const { busy, error, reset, run } = useAction()
  const start = async (projectId: string, text: string, options: StartArgs[2] = {}, fallback = 'Failed to start the agent.') => {
    const outcome = await run(() => sendStart(projectId, text, options), fallback)
    return outcome.ok ? outcome.value : undefined
  }
  return { busy, error, reset, start }
}
