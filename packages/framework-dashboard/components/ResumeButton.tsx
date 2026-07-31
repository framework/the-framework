import { Play } from 'lucide-react'
import { agentForDriver } from '@gemstack/the-framework/client'
import { useStartRun } from '../lib/use-start-run.js'
import { Button } from './ui/button.js'

// Resume-on-demand for a stopped session (#1391). Stop is pause semantics — it kills the turn and
// keeps the worktree — but picking the work back up used to require typing a message into the
// composer (#762). The pause half had a button; the resume half gets one here, in the action bar
// like "Merge PR", because a session you paused is a session with a next step worth offering.

/**
 * What a Resume press asks the agent to do. The resumed agent has its whole conversation back —
 * the only thing it is missing is why it stopped, and "the user pressed Stop" must not read as
 * "the work was done". The wording mirrors the daemon's own RESUME_PROMPT (#923), minus the
 * restart framing that does not apply here.
 */
export const RESUME_MESSAGE =
  'This session was stopped before it finished, not because the work was done. Look at what you had already done, then carry on from there.'

export function ResumeButton({
  projectId,
  runId,
  sessionId,
  driver,
  onRunStarted,
}: {
  projectId: string
  runId: string
  /** The agent session to resume — the button is only offered once the run has reported one. */
  sessionId: string
  /** The driver that ran it, so the continuation resumes on the same agent (#831). */
  driver?: string | undefined
  onRunStarted?: ((intent: string, runId?: string) => void) | undefined
}) {
  const { busy, error, start } = useStartRun()
  const resume = async () => {
    // The same continuation the composer sends (#720/#762): a `prompt` run seeded with the
    // session id, writing into the same run and branch, on the run's own agent.
    const agent = agentForDriver(driver)
    const result = await start(
      projectId,
      RESUME_MESSAGE,
      'prompt',
      {
        resumeSession: sessionId,
        continueRunId: runId,
        ...(agent && agent !== 'claude' ? { agent } : {}),
      },
      'Failed to resume the session.',
    )
    if (result) onRunStarted?.(RESUME_MESSAGE, result.runId)
  }
  return (
    <>
      {error && <span className="text-danger">{error}</span>}
      <Button size="xs" disabled={busy} onClick={() => void resume()}>
        <Play className="h-3.5 w-3.5" />
        {busy ? 'Resuming…' : 'Resume'}
      </Button>
    </>
  )
}
