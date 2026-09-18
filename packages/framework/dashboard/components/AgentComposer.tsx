import { useEffect, useRef, useState } from 'react'
import { Loader2, Play, Square } from 'lucide-react'
import { Composer, type ComposerHandle } from './Composer.js'
import { sendMessage, sendStop } from '../rpc/control.js'
import { useAction } from '../lib/use-action.js'
import type { AgentOutcome } from '../lib/live-state.js'
import { Button } from './ui/button.js'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip.js'

/**
 * What a Resume press says to the agent (#1391). The resumed agent has its whole conversation
 * back — the only thing it is missing is why it stopped, and "the user pressed Stop" must not
 * read as "the work was done".
 */
export const RESUME_MESSAGE =
  'This session was stopped before it finished, not because the work was done. Look at what you had already done, then carry on from there.'

// One composer for a session, live or finished (#1026).
//
// A send is always the same call, `sendMessage`: the person's words, the next prompt of the same
// conversation (#1774). What happens to them is the daemon's side of it: a run that is working
// takes them from its inbox when its turn ends, and an ended run is continued with them through
// the project's resume hook — the same run, the same row, the same branch. The composer never
// remounts when the agent ends, so a half-typed message survives it.
//
// The empty box's submit slot is the session's control (#1455): Stop while the agent is live,
// Resume once it was stopped. Typing swaps the slot back to the send ↑ — one slot, three states,
// like Claude Code's composer.
export function AgentComposer({
  projectId,
  agentId,
  live,
  files,
  onAgentStarted,
  outcome,
}: {
  projectId: string
  /** Which run this addresses (#749). */
  agentId: string
  /** Whether the agent is still running: what a send does is the same call, the note differs. */
  live: boolean
  files: string[]
  /** An ended run was continued: the shell follows the same run as it goes live again. */
  onAgentStarted?: ((intent: string, agentId: string) => void) | undefined
  /** How the agent ended (#948), so the note does not call a crash "ended". */
  outcome?: AgentOutcome | undefined
}) {
  const composerRef = useRef<ComposerHandle>(null)
  const { busy, error, run } = useAction()
  // The slot's Stop (#1455), its own action so a message send's busy beat cannot read as
  // "stopping". A landed Stop stays "Stopping…" until the end event flips `live`, so it cannot
  // be re-fired. Released the moment `live` drops, not only on an agent switch: a Resume continues
  // the SAME agent (#762), so a latch keyed to the agent id alone re-engaged on the resumed
  // session and froze its Stop as a disabled spinner.
  const { busy: stopBusy, error: stopError, run: runStop } = useAction()
  const [stopRequested, setStopRequested] = useState(false)
  useEffect(() => setStopRequested(false), [agentId])
  useEffect(() => {
    if (!live) setStopRequested(false)
  }, [live])
  // The mirror latch for Resume (#1460): between the resume resolving and the resumed leg's
  // first event flipping `live`, `outcome` momentarily stops reading `stopped` — without this the
  // slot flickered Resume → collapsed → Stop. Released when the agent reads live (the normal exit)
  // or when the row changes under the composer.
  const [resuming, setResuming] = useState(false)
  useEffect(() => setResuming(false), [agentId])
  useEffect(() => {
    if (live) setResuming(false)
  }, [live])
  const stopping = stopBusy || (stopRequested && live)
  // The last message that went through: a line in the inbox is invisible until the agent takes
  // it when its turn ends, so without this the send looked like nothing happened (#948).
  // Reset like the latches above: the note is about THIS agent's live session, so it must not
  // survive an agent switch or outlive the session it was queued into.
  const [queued, setQueued] = useState<string | null>(null)
  useEffect(() => setQueued(null), [agentId])
  useEffect(() => {
    if (!live) setQueued(null)
  }, [live])

  /** Say `text` to the run. Resolves whether it went through; a refusal's words are shown. */
  const say = async (text: string): Promise<boolean> => {
    const wasLive = live
    const outcome = await run(
      () => sendMessage(projectId, text, agentId),
      'Could not send. Your text is kept, try again.',
    )
    if (!outcome.ok) return false
    if (wasLive) setQueued(text)
    // An ended run goes live again under the same id: tell the shell, which keeps its feed (#762).
    else onAgentStarted?.(text, agentId)
    return true
  }

  const send = async (text: string): Promise<void> => {
    if (busy) return
    if (await say(text)) composerRef.current?.clear()
    composerRef.current?.focus()
  }

  const stopSession = () =>
    void runStop(() => sendStop(projectId, agentId).then(() => true), 'Could not stop the agent.').then(result => {
      if (result) setStopRequested(true)
    })

  // The slot's Resume (#1391): the stock RESUME_MESSAGE instead of typed text.
  const resume = async () => {
    if (busy) return
    if (await say(RESUME_MESSAGE)) setResuming(true)
  }

  // The empty box's slot control (#1455): Stop while live, Resume once stopped. Ended any other
  // way, the slot keeps the launcher's collapse-when-empty.
  const idleControl = live ? (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            size="icon-sm"
            onClick={stopSession}
            disabled={stopping}
            aria-label="Stop agent"
            className="h-8 w-8 shrink-0 disabled:opacity-100"
          />
        }
      >
        {stopping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-3 w-3 fill-current" />}
      </TooltipTrigger>
      <TooltipContent>{stopping ? 'Stopping…' : 'Stop agent'}</TooltipContent>
    </Tooltip>
  ) : outcome?.stopped || resuming ? (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            size="icon-sm"
            onClick={() => void resume()}
            disabled={busy || resuming}
            aria-label="Resume"
            className="h-8 w-8 shrink-0 disabled:opacity-100"
          />
        }
      >
        {busy || resuming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />}
      </TooltipTrigger>
      <TooltipContent>{busy || resuming ? 'Resuming…' : 'Resume the agent'}</TooltipContent>
    </Tooltip>
  ) : undefined

  const surfacedError = error ?? stopError

  return (
    <div className="p-2">
      <Note live={live} outcome={outcome} queued={queued} muted={Boolean(surfacedError)} />
      {surfacedError && <p role="alert" className="mb-1 px-2 text-xs text-danger">{surfacedError}</p>}
      <Composer
        ref={composerRef}
        files={files}
        onSubmit={send}
        busy={busy}
        submitLabel="Send"
        submitBusyLabel={live ? 'Sending…' : 'Resuming…'}
        showDriverModel={false}
        inAgent
        idleControl={idleControl}
        placeholder={
          live
            ? 'Message the agent…  ( / commands · @ projects · # files )'
            : 'Message the agent to continue it…  ( / commands · @ projects · # files )'
        }
      />
    </div>
  )
}

/** What a send will do from here, in one line — it is not the same thing live and ended. */
function Note({
  live,
  outcome,
  queued,
  muted,
}: {
  live: boolean
  outcome: AgentOutcome | undefined
  queued: string | null
  muted: boolean
}) {
  if (live) {
    if (!queued || muted) return null
    return (
      <p role="status" className="mb-1 truncate px-2 text-xs text-muted-foreground">
        Queued — the session reads it when its turn ends: &ldquo;{queued}&rdquo;
      </p>
    )
  }
  const text = outcome?.waiting
    ? 'The agent asked a question — answer it above, or your next message continues the session.'
    : outcome && !outcome.ok && !outcome.stopped
      ? 'Session failed — your next message resumes it where it stopped.'
      : outcome?.stopped
        ? 'Session stopped — your next message resumes it.'
        : 'Agent ended — your next message continues it.'
  return <p className="mb-2 px-2 text-xs text-muted-foreground">{text}</p>
}
