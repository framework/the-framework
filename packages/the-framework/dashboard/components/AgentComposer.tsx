import { useEffect, useRef, useState } from 'react'
import { Loader2, Play, Square } from 'lucide-react'
import { driverFromImpl } from '../../dist/client.js'
import { Composer, type ComposerHandle } from './Composer.js'
import { sendMessage, sendStop } from '../rpc/control.js'
import { useAction } from '../lib/use-action.js'
import { useStartRun } from '../lib/use-start-run.js'
import type { RunOutcome } from '../lib/live-state.js'
import { Button } from './ui/button.js'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip.js'

/**
 * What a Resume press asks the agent to do (#1391). The resumed agent has its whole conversation
 * back — the only thing it is missing is why it stopped, and "the user pressed Stop" must not
 * read as "the work was done". The wording mirrors the daemon's own RESUME_PROMPT (#923), minus
 * the restart framing that does not apply here.
 */
export const RESUME_MESSAGE =
  'This session was stopped before it finished, not because the work was done. Look at what you had already done, then carry on from there. ' +
  'The session lifecycle still applies: once the work is genuinely finished with nothing left to do, call setReadyForMerge() — without it the finished work is never merged.'

// One composer for a session, live or finished (#1026).
//
// There used to be two: RunChat while the run was running, RunResumeChat once it ended. They
// looked identical and differed only in what submit did, but the session view swapped one for the
// other the moment a run stopped — so the editor remounted under the user, taking any half-typed
// message with it, and for a run that never reported a session id the composer vanished entirely
// and left a dead end.
//
// So the composer stays; the send changes:
//   - running          → a `message` control entry the run drains between turns (#714)
//   - ended, resumable → a fresh run seeded with `--resume <sessionId>`, continuing this run (#720)
//   - ended, no id     → a new session carrying the text, which is all that is left to offer
// A new-session preset (#959) always starts its own run, in every one of those states.
//
// The empty box's submit slot is the session's control (#1455): Stop while the run is live (the
// pause that used to hide in the ⋮ menu), Resume once it was stopped (the offer that used to sit
// in the action bar, #1391). Typing swaps the slot back to the send ↑ — one slot, three states,
// like Claude Code's composer.
export function AgentComposer({
  projectId,
  agentId: agentId,
  live,
  sessionId,
  driver,
  files,
  addContext,
  removeContext,
  sessionName,
  onRunStarted,
  outcome,
}: {
  projectId: string
  /** Which run this addresses (#749); absent falls back to the project's control log. */
  agentId?: string | null | undefined
  /** Whether the run is still running — the only thing that changes what a send does. */
  live: boolean
  /** The agent session id, once reported: what a finished run resumes from. */
  sessionId?: string | undefined
  /** The driver that ran it, so a continuation resumes on the same agent (#831). */
  driver?: string | undefined
  files: string[]
  addContext: (path: string) => void
  /** Drop a path from the run Context when its chip leaves the editor (#948). */
  removeContext?: ((path: string) => void) | undefined
  /** This session's name (#874), so a preset launched here targets it by default. */
  sessionName?: string | undefined
  onRunStarted?: ((intent: string, agentId?: string) => void) | undefined
  /** How the run ended (#948), so the note does not call a crash "ended". */
  outcome?: RunOutcome | undefined
}) {
  const composerRef = useRef<ComposerHandle>(null)
  const { busy, error, run } = useAction()
  const { busy: starting, error: startError, start } = useStartRun()
  // The slot's Stop (#1455), its own action so a message send's busy beat cannot read as
  // "stopping". A landed Stop stays "Stopping…" until the end event flips `live`, so it cannot
  // be re-fired — the same latch the ⋮ menu's Stop keeps. Released the moment `live` drops, not
  // only on a run switch: a Resume continues the SAME run (#762), so a latch keyed to the run id
  // alone re-engaged on the resumed session and froze its Stop as a disabled spinner.
  const { busy: stopBusy, error: stopError, run: runStop } = useAction()
  const [stopRequested, setStopRequested] = useState(false)
  useEffect(() => setStopRequested(false), [agentId])
  useEffect(() => {
    if (!live) setStopRequested(false)
  }, [live])
  // The mirror latch for Resume (#1460): between the resume RPC resolving and the resumed leg's
  // first event flipping `live`, `outcome` momentarily stops reading `stopped` — without this the
  // slot flickered Resume → collapsed → Stop. Released when the run reads live (the normal exit)
  // or when the row changes under the composer.
  const [resuming, setResuming] = useState(false)
  useEffect(() => setResuming(false), [agentId])
  useEffect(() => {
    if (live) setResuming(false)
  }, [live])
  const stopping = stopBusy || (stopRequested && live)
  // The last message that went through: a queued control entry is invisible until the agent
  // drains it between turns, so without this the send looked like nothing happened (#948).
  const [queued, setQueued] = useState<string | null>(null)
  const resumable = !live && sessionId !== undefined

  const send = async (text: string, _kind: 'build' | 'prompt', opts: { newSession: boolean }): Promise<void> => {
    if (busy || starting) return
    // A new-session preset is not a continuation (#959): it drops the resume seed and the run id,
    // so it opens its own run with its own worktree, branch and transcript.
    if (opts.newSession || (!live && !resumable)) {
      const started = await start(projectId, text, 'prompt', {})
      if (started) {
        composerRef.current?.clear()
        onRunStarted?.(text, started.agentId)
      }
      composerRef.current?.focus()
      return
    }
    if (live) {
      // sendMessage resolves void; map success to `true` so it is tellable from useAction's
      // failure `undefined`.
      const result = await run(
        () => sendMessage(projectId, text, agentId ?? undefined).then(() => true),
        'Could not send — the session may have just ended. Your text is kept, try again.',
      )
      if (result) {
        setQueued(text)
        composerRef.current?.clear()
      }
      composerRef.current?.focus()
      return
    }
    // A continuation is a `prompt` run seeded with the finished run's session id (#720). It
    // resumes on the run's own agent; the model and the system-prompt options are moot here, since
    // the resumed transcript keeps the framing and model it already had.
    // The session records the implementation that ran it; the option takes the driver name (#831).
    const picked = driverFromImpl(driver)
    const result = await start(
      projectId,
      text,
      'prompt',
      {
        resumeSession: sessionId as string,
        // Continue this run rather than opening a new row (#762): the follow-up writes into the
        // same run, on the same branch, so one thing you asked for stays one entry.
        ...(agentId ? { continueRunId: agentId } : {}),
        ...(picked && picked !== 'claude' ? { driver: picked } : {}),
      },
      'Failed to continue the session.',
    )
    if (result) {
      composerRef.current?.clear()
      onRunStarted?.(text, result.agentId) // select the run we just started (#761)
    }
  }

  const stopSession = () =>
    void runStop(() => sendStop(projectId, agentId ?? undefined).then(() => true), 'Could not stop the session.').then(result => {
      if (result) setStopRequested(true)
    })

  // The action-bar ResumeButton's continuation (#1391), moved into the slot: the same `prompt`
  // run seeded with the session id — same row, same branch, same agent conversation — carrying
  // the stock RESUME_MESSAGE instead of typed text.
  const resume = async () => {
    if (starting || !sessionId) return
    const picked = driverFromImpl(driver)
    const result = await start(
      projectId,
      RESUME_MESSAGE,
      'prompt',
      {
        resumeSession: sessionId,
        ...(agentId ? { continueRunId: agentId } : {}),
        ...(picked && picked !== 'claude' ? { driver: picked } : {}),
      },
      'Failed to resume the session.',
    )
    if (result) {
      setResuming(true)
      onRunStarted?.(RESUME_MESSAGE, result.agentId)
    }
  }

  // The empty box's slot control (#1455): Stop while live, Resume once stopped-with-an-id (#1322:
  // without a session id there is nothing any agent could resume). Ended any other way, the slot
  // keeps the launcher's collapse-when-empty.
  const idleControl = live ? (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            size="icon-sm"
            onClick={stopSession}
            disabled={stopping}
            aria-label="Stop session"
            className="h-8 w-8 shrink-0 disabled:opacity-100"
          />
        }
      >
        {stopping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-3 w-3 fill-current" />}
      </TooltipTrigger>
      <TooltipContent>{stopping ? 'Stopping…' : 'Stop session'}</TooltipContent>
    </Tooltip>
  ) : resumable && (outcome?.stopped || resuming) ? (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            size="icon-sm"
            onClick={() => void resume()}
            disabled={starting || resuming}
            aria-label="Resume"
            className="h-8 w-8 shrink-0 disabled:opacity-100"
          />
        }
      >
        {starting || resuming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />}
      </TooltipTrigger>
      <TooltipContent>{starting || resuming ? 'Resuming…' : 'Resume the session'}</TooltipContent>
    </Tooltip>
  ) : undefined

  const surfacedError = error ?? startError ?? stopError

  return (
    <div className="p-2">
      <Note live={live} resumable={resumable} outcome={outcome} queued={queued} muted={Boolean(surfacedError)} />
      {surfacedError && <p role="alert" className="mb-1 px-2 text-xs text-danger">{surfacedError}</p>}
      <Composer
        ref={composerRef}
        files={files}
        addContext={addContext}
        removeContext={removeContext}
        onSubmit={send}
        busy={busy || starting}
        submitLabel="Send"
        submitBusyLabel={live ? 'Sending…' : resumable ? 'Resuming…' : 'Starting…'}
        showDriverModel={false}
        inSession
        // Ended → the next message starts a new leg, whose options the gear can shape (#1172);
        // live → nothing is adjustable and the gear is dropped rather than opening empty.
        sessionEnded={!live}
        sessionName={sessionName}
        idleControl={idleControl}
        placeholder={
          live
            ? 'Message the session…  ( / commands · < tags · @ projects · # files )'
            : resumable
              ? 'Message the session to continue it…  ( / commands · < tags · @ projects · # files )'
              : // Not a continuation at all, so the box says so itself rather than a note above it
                // saying one thing and the box below inviting another (see {@link Note}).
                NOT_CONTINUABLE
        }
      />
    </div>
  )
}

/** A run that ended before reporting a session id cannot be resumed by any agent — the one state
 *  where the box is not a continuation. It is the composer's own placeholder rather than a note
 *  above it: the message is about what typing here does, so it belongs where you type. */
const NOT_CONTINUABLE =
  'This session can’t be continued — it ended before the agent reported a session id. Your next message starts a new one.'

/** What a send will do from here, in one line — it is not the same thing in all three states. */
function Note({
  live,
  resumable,
  outcome,
  queued,
  muted,
}: {
  live: boolean
  resumable: boolean
  outcome: RunOutcome | undefined
  queued: string | null
  muted: boolean
}) {
  if (live) {
    if (!queued || muted) return null
    return (
      <p role="status" className="mb-1 truncate px-2 text-xs text-muted-foreground">
        Queued — the session reads it between turns: &ldquo;{queued}&rdquo;
      </p>
    )
  }
  // The one case that is not a continuation says so in the composer's placeholder (NOT_CONTINUABLE),
  // so it is not also said here.
  if (!resumable) return null
  const text =
    outcome && !outcome.ok && !outcome.stopped
      ? 'Session failed — your next message resumes it where it stopped.'
      : outcome?.stopped
        ? 'Session stopped — your next message resumes it.'
        : 'Session ended — your next message continues it.'
  return <p className="mb-2 px-2 text-xs text-muted-foreground">{text}</p>
}
