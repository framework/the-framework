import { useCallback, useEffect, useState } from 'react'
import type { FrameworkEvent } from '@gemstack/the-framework'
import { handoffState, loopStatus, runProgress, sessionInfo, type LoopStatus } from '@gemstack/the-framework/client'
import { onRun, onRetainedWorktrees } from '../server/reads.telefunc.js'
import { useLoaded } from '../lib/use-async.js'
import { useRunHandoff } from '../lib/use-run-handoff.js'
import { agentSettled, runOutcome } from '../lib/live-state.js'
import { RunActionBar } from './RunActionBar.js'
import { RunComposer } from './RunComposer.js'
import { RunFeed } from './RunFeed.js'
import { ActionsRunNotice } from './ActionsRunNotice.js'
import { CloudMirrorRow, CloudRunNotice } from './CloudRunNotice.js'
import { RemoteRunNotice } from './RemoteRunNotice.js'
import { ChangesSummary, RunChanges } from './RunChanges.js'
import { HandoffActions, HandoffArm, HandoffSummary, RunHandoffDetails } from './RunHandoff.js'
import { SessionDetails } from './SessionDetails.js'

// One session's view, whether it is running or finished (#1026).
//
// This used to be two components — RunLive and RunReplay — and the page swapped one for the other
// the instant a run's status flipped. Everything remounted at once: the action bar blanked while
// its git read went out again, the output was replaced by "Loading session…" while the archived
// log was fetched, the run overview disappeared, and the composer was rebuilt. A session ending is
// the moment you are most likely to be reading it, and the whole page flinched.
//
// So the frame is stable and only its contents change: the same bar, feed and composer stay
// mounted, and `live` decides what they say. The log is the same log — while the run is live it
// arrives over the channel, and once it ends the archived copy is read and swapped in behind the
// events already on screen.
export function RunView({
  projectId,
  runId,
  events,
  live,
  label,
  projectName,
  target,
  remoteLabel,
  files,
  addContext,
  removeContext,
  lost = false,
  armedDefault,
  onRunStarted,
  onDeleted,
  onLoopStatus,
}: {
  projectId: string
  /** Which run this is (#749); absent right after Start, before the poll adopts its id. */
  runId?: string | null | undefined
  /** The live channel's events for this run — all there is while it runs. */
  events: FrameworkEvent[]
  /** Whether the run is still running. */
  live: boolean
  /** The session's own name — the same label the rail shows (#1030). It leads the action bar as
   * the stable identity, so the branch renaming itself near the end of a run (#736) reads as a
   * detail changing rather than the whole view changing. */
  label?: string | undefined
  /** The session's project, shown as a `project / session` breadcrumb in the action bar. */
  projectName?: string | null | undefined
  /** The armed handoff pair from the run record (#1376) — the mirror a live tab needs because the
   * opening `handoff-armed` event predates the channel. Absent (no record yet) keeps the armed
   * default. */
  armedDefault?: { push: boolean; pr: boolean } | undefined
  /** Where the run executes (#1053/#610): `actions` swaps the live feed for a burst-mode affordance; `remote` is relayed to a device (#1067); `web` is handed to a Claude Code cloud session. */
  target?: 'local' | 'actions' | 'remote' | 'web' | undefined
  /** The device this run executes on (#1067), when it is relayed to a connected one. Set only for a
   *  just-started remote run: its diff, handoff, and push/PR now relay to the device (slice 2), so the
   *  panels are shown, and a "runs on <device>" notice only flags that the browser preview stays local. */
  remoteLabel?: string | undefined
  files: string[]
  addContext: (path: string) => void
  removeContext?: ((path: string) => void) | undefined
  /** The live channel's health (#948) — surfaced as a banner over the feed. */
  lost?: boolean
  /** Jump to the run a preset or a continuation started (#959). */
  onRunStarted?: ((intent: string, runId?: string) => void) | undefined
  /** Leave this session after it is deleted (#1032) — back to the project home. */
  onDeleted?: (() => void) | undefined
  /** The loop's verdict, handed up so the right rail can pin it under its tabs. It is reported from
   *  here rather than read in the shell because a finished run's log is archived, and this view is
   *  the one that reads it back. */
  onLoopStatus?: ((loop: LoopStatus | null) => void) | undefined
}) {
  // The archived log, read only once the run has ended: while it runs, the channel is the truth.
  const archived = useLoaded<FrameworkEvent[] | null>(
    !live && runId ? () => onRun(projectId, runId) : null,
    null,
    [projectId, runId, live],
  )
  // Whether this run kept its worktree (#737): a failed/stopped run does, a clean one had it
  // removed when it finished. Drives the Remove button, and is cleared locally once removed so
  // the button goes without waiting for a refetch.
  const retained = useLoaded<string[]>(!live && runId ? () => onRetainedWorktrees(projectId) : null, [], [projectId, runId, live])
  const [removed, setRemoved] = useState(false)
  const onWorktreeRemoved = useCallback(() => setRemoved(true), [])
  const hasWorktree = !live && !removed && runId !== null && runId !== undefined && retained.includes(runId)

  // Whether the agent is still working, which is not whether the run's process is up (#1173).
  // A session that has settled parks on you but stays alive to take your next message (#785/#714),
  // so its status reads `running` indefinitely. Keying the handoff off `live` meant a finished
  // session showed its two arming checkboxes for ever and never offered the action they describe
  // — the agent was done, and the answer to "what do I do now?" was nothing.
  // Read off the channel rather than `shown`: while the run is live those are the same events,
  // and once it is not, `working` is false whatever they say.
  const working = live && !agentSettled(events)

  // What the branch holds (#1023), read once for both the bar and the detail it opens. Read once
  // the agent stops rather than once the process does: while it is still writing to the branch
  // there is nothing to hand off yet, but a parked session's branch is finished work.
  const handoff = useRunHandoff(projectId, runId ?? null, !working)
  const [changes, setChanges] = useState({ count: 0, added: 0, removed: 0 })
  const [open, setOpen] = useState(false)
  const onChangesSummary = useCallback((count: number, added: number, removed: number) => {
    setChanges(prev => (prev.count === count && prev.added === added && prev.removed === removed ? prev : { count, added, removed }))
  }, [])
  const toggle = useCallback(() => setOpen(o => !o), [])

  // The events already on screen keep their place while the archived copy is read, so a run
  // ending swaps the source without blanking the output. An EMPTY archive never replaces them
  // either (#1383): `onRun` answers `[]` both for "gone" and for "not archived yet", and a Stop
  // races the archive write — swapping the live feed for that `[]` blanked the view to "This
  // session has no events." until a manual refresh.
  const shown = live ? events : (archived?.length ? archived : events)
  const session = sessionInfo(shown)
  const progress = runProgress(shown)
  // How the run ended (#948) — read once for the composer's note and the Resume offer below.
  const outcome = live ? undefined : runOutcome(shown)
  // What the session hands back when it ends (#1102), folded from its own events, seeded from the
  // run record's mirror (#1376): the opening `handoff-armed` event is written before the live
  // channel attaches, so a live tab misses it and the fold alone re-arms what the launcher
  // disarmed — the record's snapshot is how the boxes read the same whether this tab watched the
  // run start or was opened halfway through.
  const armed = handoffState(shown, armedDefault)
  // The loop's verdict goes to the rail, not above the feed. Reported on its VALUE, not the object
  // (a fold rebuilds it every render), so a passing verdict is handed up once and not on every tick.
  const loop = loopStatus(shown)
  const loopKey = loop ? [loop.pass, loop.passing, loop.productionGrade, loop.finished, ...loop.blockers].join(' ') : ''
  useEffect(() => {
    onLoopStatus?.(loop)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by value; `loop` is a fresh object each render
  }, [loopKey, onLoopStatus])
  // Leaving the session clears it, so the rail does not keep one run's verdict over the next.
  useEffect(() => () => onLoopStatus?.(null), [onLoopStatus])
  // Until the handoff has actually loaded, a just-stopped run keeps showing the file counts it
  // ended with (#1030): the summary swaps once, from the live counts to the handoff, instead of
  // blanking for the beat the handoff read takes.
  const showHandoff = !working && handoff.loaded

  return (
    <>
      <RunActionBar
        projectId={projectId}
        runId={runId}
        events={shown}
        label={label ?? progress.sessionName}
        projectName={projectName}
        retainedWorktree={hasWorktree}
        onWorktreeRemoved={onWorktreeRemoved}
        onDeleted={onDeleted}
        summary={
          showHandoff ? (
            <>
              <HandoffSummary handoff={handoff.handoff} />
              {/* An automatic handoff that failed has to say so here (#1102): the buttons coming
                  back is the offer to retry, but on its own it looks like nothing was tried. */}
              {armed.result?.outcome === 'failed' && (
                <span className="text-danger">auto-handoff failed: {armed.result.error}</span>
              )}
              {handoff.error && <span className="text-danger">{handoff.error}</span>}
            </>
          ) : (
            <ChangesSummary {...changes} />
          )
        }
        expanded={open}
        onToggle={toggle}
        actions={
          runId ? (
            working ? (
              <HandoffArm projectId={projectId} runId={runId} state={armed} />
            ) : (
              // Resume-on-demand (#1391) used to lead this cluster; it now lives in the
              // composer's submit slot (#1455), one slot with Stop and the send arrow.
              <HandoffActions projectId={projectId} runId={runId} state={handoff} />
            )
          ) : undefined
        }
      />
      {/* The always-available session-details strip: agent + spend (#322). Sits above the changes/
          handoff detail, so the disclosure holds the "about this run" facts plus what it touched. */}
      {open && <SessionDetails events={shown} />}
      {/* What the session has touched, behind the branch row's disclosure. While it runs that is
          its worktree; once it ends, the branch it left behind. The live read needs the run's id:
          without one it falls back to the project root and would report the user's own dirty
          files as the run's. A remote run's worktree lives on the device, but the diff now relays
          there (#1067 slice 2), so it is shown like a local run's, not suppressed. */}
      {working && runId && <RunChanges projectId={projectId} runId={runId} open={open} onSummary={onChangesSummary} />}
      {!working && open && <RunHandoffDetails handoff={handoff.handoff} />}
      {/* A GitHub Actions run replays in a burst at the end (#1053), so the live feed looks stalled:
          say the wait is expected and link through to the live Actions run. */}
      <ActionsRunNotice target={target} events={shown} live={live} />
      {/* A run handed to Claude Code on the web (#610): the work is happening in a cloud session
          this machine cannot stream, so point at where it is rather than show an empty feed. */}
      <CloudRunNotice target={target} events={shown} />
      {/* A run relayed to a connected device (#1067): its diff, handoff, and push/PR now relay to the
          device (slice 2), so this notice only flags that the browser preview stays local-only for now. */}
      <RemoteRunNotice device={remoteLabel} />
      {/* Nothing to show yet is not the same thing in both states: a live run is waiting for its
          first event, a finished one is still reading its log. */}
      {!live && archived === null && shown.length === 0 ? (
        <div className="grid flex-1 place-items-center text-sm text-muted-foreground">Loading session…</div>
      ) : (
        // A finished log is static, so it does not follow new output; it opens at the end, where
        // the outcome, the final spend and the last changes are (#948).
        <RunFeed
          events={shown}
          showSessionLink={false}
          showName={false}
          showStatus={false}
          showLoop={false}
          lost={lost}
          {...(live ? {} : { stick: false, openAt: 'end' as const, emptyLabel: 'This session has no events.' })}
          // A web run's log dead-ends at the hand-off (#1265): the mirror box rides the tail of
          // the scroller, where "and then…" belongs. Self-nulling for every other target.
          tail={<CloudMirrorRow target={target} events={shown} />}
        />
      )}
      <RunComposer
        projectId={projectId}
        runId={runId}
        live={live}
        sessionId={session?.sessionId}
        driver={session?.driver}
        files={files}
        addContext={addContext}
        removeContext={removeContext}
        sessionName={progress.sessionName}
        onRunStarted={onRunStarted}
        outcome={outcome}
      />
    </>
  )
}
