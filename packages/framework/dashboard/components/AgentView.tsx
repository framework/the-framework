import { useCallback, useEffect, useState } from 'react'
import type { FrameworkEvent } from '../../src/index.js'
import { onAgent, onRetainedWorktrees } from '../rpc/reads.js'
import { useLoaded } from '../lib/use-async.js'
import { useAgentHandoff } from '../lib/use-agent-handoff.js'
import { isAgentActive, agentOutcome } from '../lib/live-state.js'
import type { AgentCardFacts } from '../lib/agent-status.js'
import { AgentActionBar } from './AgentActionBar.js'
import { AgentComposer } from './AgentComposer.js'
import { AgentFeed } from './AgentFeed.js'
import { ActionsRunNotice } from './ActionsRunNotice.js'
import { CloudMirrorRow, CloudAgentNotice } from './CloudAgentNotice.js'
import { RemoteAgentNotice } from './RemoteAgentNotice.js'
import { ModuleSlot } from './ModulePageView.js'
import { useMountedModules } from '../lib/use-modules.js'
import { HandoffActions, HandoffSummary, AgentHandoffDetails } from './AgentHandoff.js'
import { AgentDetails, type AgentDetailsCard } from './AgentDetails.js'

// One session's view, whether it is running or finished (#1026).
//
// This used to be two components — AgentLive and AgentReplay — and the page swapped one for the other
// the instant an agent's status flipped. Everything remounted at once: the action bar blanked while
// its git read went out again, the output was replaced by "Loading session…" while the archived
// log was fetched, the agent overview disappeared, and the composer was rebuilt. A session ending is
// the moment you are most likely to be reading it, and the whole page flinched.
//
// So the frame is stable and only its contents change: the same bar, feed and composer stay
// mounted, and `live` decides what they say. The log is the same log — while the agent is live it
// arrives over the channel, and once it ends the archived copy is read and swapped in behind the
// events already on screen.
/** How long the bar waits for the run's own reads before it shows the facts that are in. */
const READY_WAIT_MS = 1_000

export function AgentView({
  projectId,
  agentId: agentId,
  events,
  live,
  card,
  label,
  projectName,
  target,
  remoteLabel,
  files,
  lost = false,
  writing = '',
  startedWith,
  onAgentStarted,
  onDeleted,
}: {
  projectId: string
  /** Which run this is (#749); absent right after Start, before the poll adopts its id. */
  agentId: string
  /** The live channel's events for this agent — all there is while it runs. */
  events: FrameworkEvent[]
  /** Whether the agent is still running; `null` while the daemon's list of agents has not been read, so it is not known yet. */
  live: boolean | null
  /** What the run's card says, off the runs poll: the status pill's and the details strip's facts the feed cannot carry. Absent until the card is listed. */
  card?: (AgentCardFacts & AgentDetailsCard) | undefined
  /** The session's own name — the same label the rail shows (#1030). It leads the action bar as
   * the stable identity, so the branch renaming itself near the end of an agent (#736) reads as a
   * detail changing rather than the whole view changing. */
  label?: string | undefined
  /** The session's project, shown as a `project / session` breadcrumb in the action bar. */
  projectName?: string | null | undefined
  /** Where the agent executes (#1053/#610): `actions` swaps the live feed for a burst-mode affordance; `remote` is relayed to a device (#1067); `web` is handed to a Claude Code cloud session. */
  target?: 'local' | 'actions' | 'remote' | 'web' | undefined
  /** The device this agent executes on (#1067), when it is relayed to a connected one. Set only for a
   *  just-started remote run: its diff, handoff, and push/PR now relay to the device (slice 2), so the
   *  panels are shown, and a "runs on <device>" notice only flags that the browser preview stays local. */
  remoteLabel?: string | undefined
  files: string[]
  /** The live channel's health (#948) — surfaced as a banner over the feed. */
  lost?: boolean
  /** The message the agent is writing, as far as it has got: shown after the feed while it runs. */
  writing?: string
  /** The prompt this page just started the agent with: shown until the agent's own prompt line arrives. */
  startedWith?: string | undefined
  /** Jump to the agent a preset or a continuation started (#959). */
  onAgentStarted?: ((intent: string, agentId: string) => void) | undefined
  /** Leave this session after it is deleted (#1032) — back to the project home. */
  onDeleted?: (() => void) | undefined
  /** The loop's verdict, handed up so the right rail can pin it under its tabs. It is reported from
   *  here rather than read in the shell because a finished agent's log is archived, and this view is
   *  the one that reads it back. */
}) {
  // The archived log, read only once the agent has ended: while it runs, the channel is the truth.
  // `archiveBehind` re-reads it whenever the live channel has outgrown the copy on screen (#1460):
  // a resumed session streams new events while `live` is still false for a poll round-trip, and a
  // line written as a clean run is recorded only ever lands in the archive — its worktree journal is
  // torn down with the worktree — so without this the PR line waited for a manual refresh.
  const [archiveBehind, setArchiveBehind] = useState(0)
  const archived = useLoaded<FrameworkEvent[] | null>(
    live === false ? () => onAgent(projectId, agentId) : null,
    null,
    [projectId, agentId, live, archiveBehind],
    // Going back to an ended run shows its log at once, as last read, while it is read again.
    { remember: `agent-log:${projectId}:${agentId}` },
  )
  // Whether this agent kept its worktree (#737): a failed/stopped run does, a clean one had it
  // removed when it finished. Drives the Remove button, and is cleared locally once removed so
  // the button goes without waiting for a refetch.
  const retained = useLoaded<string[]>(live === false ? () => onRetainedWorktrees(projectId) : null, [], [projectId, agentId, live], { remember: `retained:${projectId}` })
  const [removed, setRemoved] = useState(false)
  const onWorktreeRemoved = useCallback(() => setRemoved(true), [])
  // The view is mounted un-keyed, so switching agents only swaps props: per-agent latches must
  // reset by hand or the previous agent's Remove press hides this one's offer (and a stale
  // archiveBehind can swallow the catch-up re-read on an equal-length collision).
  useEffect(() => {
    setRemoved(false)
    setArchiveBehind(0)
  }, [agentId])
  const hasWorktree = live === false && !removed && retained.includes(agentId)

  // Whether the agent is still working. A run that stops on a question ends `waiting` rather than
  // staying up, so a live run is a working one. One not known yet is neither working nor ended:
  // nothing is read for it and the bar waits.
  const working = live === true

  // What the branch holds (#1023), read once for both the bar and the detail it opens. Read once
  // the agent stops rather than once the process does: while it is still writing to the branch
  // there is nothing to hand off yet, but a parked session's branch is finished work. Not while
  // the card says saving either: the checkout is being cleaned up then, and an empty branch is
  // deleted with it, so an Open PR offered in that window turned into "Branch gone" moments later.
  const handoff = useAgentHandoff(projectId, agentId, live === false && !card?.saving)
  const [open, setOpen] = useState(false)
  // What the installed modules add to this run's page: a summary in the bar, details under it.
  const { runSlots: mountedSlots } = useMountedModules()
  const runSlots = mountedSlots.filter(slots => slots.projects.includes(projectId))
  const toggle = useCallback(() => setOpen(o => !o), [])

  // The events already on screen keep their place while the archived copy is read, so an agent
  // ending swaps the source without blanking the output. An EMPTY archive never replaces them
  // either (#1383): `onAgent` answers `[]` both for "gone" and for "not archived yet", and a Stop
  // races the archive write — swapping the live feed for that `[]` blanked the view to "This
  // session has no events." until a manual refresh.
  //
  // A STALE archive never wins either (#1460): on Resume the channel streams the new leg while
  // `live` waits on the 2s runs poll, and serving the frozen archive for that window is what made
  // the whole continuation land in one jolting commit — or, when the poll lost the race entirely,
  // not render at all until a refresh. The channel is preferred the moment it knows more; the
  // archive is re-read behind it (`archiveBehind` above) and takes back over once it has caught
  // up, which is also how the epilogue's archive-only events reach the screen.
  //
  // "Knows more" is only trustworthy when the channel is this agent's OWN journal. It is not
  // guaranteed to be: an ended agent whose worktree is gone resolves to the project ROOT journal
  // server-side (resolveAgentCheckout's fallback), and that file holds whatever root run wrote it
  // last — a longer foreign feed must never beat the agent's archive. The archive is the agent's own
  // record, so its opening event is the fingerprint the channel has to match; an unloaded or
  // empty archive can't be checked and keeps the pre-existing show-the-feed fallback.
  const sameJournal =
    !archived?.length || events.length === 0 || JSON.stringify(events[0]) === JSON.stringify(archived[0])
  const feedAhead = sameJournal && events.length > (archived?.length ?? 0)
  const shown = working ? events : archived?.length && !feedAhead ? archived : events
  useEffect(() => {
    if (live === false && archived !== null && feedAhead) setArchiveBehind(events.length)
  }, [live, archived, feedAhead, events.length])
  // Live as the FEED knows it (#1460): the agents poll takes up to 2s to notice a resumed session,
  // but its events are already streaming. The feed's own verdict drives the scroll contract and
  // the composer slot, so the continuation renders (and Stop takes over from Resume) the moment
  // the first event lands rather than when the poll does.
  const feedLive = working || (feedAhead && isAgentActive(events))
  // The message just sent to an ended run, shown at the end of the feed until its own prompt line
  // arrives: the continuation writes that line only once its checkout is back, seconds later.
  const [sending, setSending] = useState<{ text: string; prompts: number } | null>(null)
  useEffect(() => setSending(null), [agentId])
  const prompts = shown.filter(e => e.kind === 'driver' && e.event.type === 'start').length
  useEffect(() => {
    if (sending && prompts > sending.prompts) setSending(null)
  }, [sending, prompts])
  const onSending = useCallback((text: string | null) => setSending(text === null ? null : { text, prompts }), [prompts])
  // A run just started writes its prompt line only once its record is saved and its checkout made.
  const shownSending = sending?.text ?? (startedWith && prompts === 0 ? startedWith : undefined)
  // How the agent ended (#948) — read once for the composer's note and the Resume offer below.
  const outcome = working ? undefined : agentOutcome(shown)
  // Until the handoff has actually loaded, a just-stopped agent keeps showing the modules' summaries
  // (the Files module's count of changed files, #1030): the summary swaps once, to the handoff,
  // instead of blanking for the beat the handoff read takes.
  const showHandoff = live === false && handoff.loaded
  // Whether this run's own facts are in, so the bar shows them together: its log (for an ended
  // run; a running one streams it) and what its branch holds (when that is read at all). Before
  // then the bar names the run and nothing else, never facts left from the run before. A run
  // seen before is ready at once, from what was read last time. A read that has not answered
  // within a second holds the bar back no longer: the facts that are in show then.
  // Which run the second has passed for: a flag would still be the last run's for a frame.
  const [waitedFor, setWaitedFor] = useState<string | null>(null)
  useEffect(() => {
    const timer = setTimeout(() => setWaitedFor(agentId), READY_WAIT_MS)
    return () => clearTimeout(timer)
  }, [agentId])
  // The branch's answer counts once its pull request lookup is in too: the bar offers nothing
  // while it is out, so showing the facts before it would add them in two steps.
  const branchRead = card?.saving === true || (handoff.loaded && !handoff.handoff?.prPending)
  const ready = working || waitedFor === agentId || (archived !== null && branchRead)
  // Whether the feed shows this agent yet. On a first visit it would otherwise pass through what
  // each read still out has to say: "Waiting for the session to start…" while the list of agents
  // is unread, the live channel's events (the project root's, for an agent whose checkout is
  // gone), "Loading agent…" while the archive is out, and only then the agent's own events. It
  // stays blank instead until the agent is known to run, its archive has answered, or the second
  // has passed, so it fills in one step. Once it has shown this agent it keeps showing it: an
  // agent that stops while watched keeps its events on screen while the archive is read.
  const [settledFor, setSettledFor] = useState<string | null>(null)
  const feedSettled = settledFor === agentId || working || archived !== null || waitedFor === agentId
  useEffect(() => {
    if (feedSettled) setSettledFor(agentId)
  }, [feedSettled, agentId])

  return (
    <>
      <AgentActionBar
        projectId={projectId}
        agentId={agentId}
        events={shown}
        card={card}
        label={label}
        projectName={projectName}
        retainedWorktree={hasWorktree}
        onWorktreeRemoved={onWorktreeRemoved}
        onDeleted={onDeleted}
        summary={
          showHandoff ? (
            <>
              <HandoffSummary handoff={handoff.handoff} />
              {handoff.error && <span className="text-danger">{handoff.error}</span>}
            </>
          ) : (
            runSlots.map(slots => {
              const Summary = slots.summary
              return Summary ? (
                <ModuleSlot key={slots.package} package={slots.package} label="run summary">
                  <Summary projectId={projectId} agentId={agentId} working={working} expanded={open} />
                </ModuleSlot>
              ) : null
            })
          )
        }
        expanded={open}
        onToggle={toggle}
        ready={ready}
        actions={
          // A run that is working publishes its own work; the next step is offered once it has ended.
          live === false ? <HandoffActions projectId={projectId} agentId={agentId} state={handoff} /> : undefined
        }
      />
      {/* The always-available session-details strip: agent + spend (#322). Sits above the changes/
          handoff detail, so the disclosure holds the "about this run" facts plus what it touched. */}
      {open && <AgentDetails events={shown} card={card} />}
      {/* What the modules add under the bar: the Files module's changed files while the run works.
          Once it ends, the handoff below says what its branch holds. A remote run's reads relay to
          its device (#1067 slice 2), so it is shown like a local run's, not suppressed. */}
      {runSlots.map(slots => {
        const Details = slots.details
        return Details ? (
          <ModuleSlot key={slots.package} package={slots.package} label="run details">
            <Details projectId={projectId} agentId={agentId} working={working} expanded={open} />
          </ModuleSlot>
        ) : null
      })}
      {live === false && open && <AgentHandoffDetails handoff={handoff.handoff} />}
      {/* A GitHub Actions run replays in a burst at the end (#1053), so the live feed looks stalled:
          say the wait is expected and link through to the live Actions run. */}
      <ActionsRunNotice target={target} events={shown} live={working} />
      {/* A run handed to Claude Code on the web (#610): the work is happening in a cloud session
          this machine cannot stream, so point at where it is rather than show an empty feed. */}
      <CloudAgentNotice target={target} events={shown} projectId={projectId} agentId={agentId} />
      {/* A run relayed to a connected device (#1067): its diff, handoff, and push/PR now relay to the
          device (slice 2), so this notice only flags that the browser preview stays local-only for now. */}
      <RemoteAgentNotice device={remoteLabel} />
      {/* Nothing to show yet is not the same thing in both states: a live run is waiting for its
          first event, a finished one is still reading its log. */}
      {!feedSettled ? (
        <div className="flex-1" />
      ) : live !== true && archived === null && shown.length === 0 ? (
        <div className="grid flex-1 place-items-center text-sm text-muted-foreground">Loading agent…</div>
      ) : (
        // A finished log is static, so it does not follow new output; it opens at the end, where
        // the outcome, the final spend and the last changes are (#948). "Live" for the scroll
        // contract is the feed's own state, not the agents poll (#1460): a resumed session streams
        // its new leg up to two seconds before `live` flips, and entering follow mode with the
        // first streamed row absorbs the continuation one event at a time instead of jolting the
        // scroller when the poll lands.
        <AgentFeed
          events={shown}
          projectId={projectId}
          agentId={agentId}
          lost={lost}
          writing={feedLive ? writing : ''}
          {...(shownSending !== undefined ? { sending: shownSending } : {})}
          working={feedLive || shownSending !== undefined}
          {...(feedLive ? {} : { stick: false, openAt: 'end' as const, emptyLabel: 'This agent has no events.' })}
          // A web agent's log dead-ends at the hand-off (#1265): the mirror box rides the tail of
          // the scroller, where "and then…" belongs. Self-nulling for every other target.
          tail={<CloudMirrorRow target={target} events={shown} />}
        />
      )}
      <AgentComposer
        projectId={projectId}
        agentId={agentId}
        live={feedLive}
        files={files}
        onAgentStarted={onAgentStarted}
        onSending={onSending}
        outcome={outcome}
      />
    </>
  )
}
