import { useEffect, useMemo, useState } from 'react'
import type { FrameworkEvent } from '../../dist/index.js'
import type { LiveFeedEvent } from '../../dist/dashboard-rpc/index.js'
import { onEvents, type EventChannel } from '../rpc/events.js'
import { currentAgentEvents } from './live-state.js'
import { stampReceived } from './event-times.js'

// The live run feed (#405), shared. The dashboard is a projection of the selected project's
// `.the-framework/events.jsonl`, streamed over Server-Sent Events that push one
// `FrameworkEvent` per new line. Both the main event view and the right rail's choice gates
// (#440) read this same stream, so the subscription lives here and each consumer owns one
// channel rather than opening a second.
//
// The feed is per RUN, not per project (#749): each run tails its own worktree's log since #736,
// so the selected run id picks the log to follow. Changing it resubscribes, which is what makes
// selecting run A vs run B show different output. Omitted (the relay, or a Start whose id has not
// been adopted yet) falls back to the project root.

/** The live feed plus whether its channel is currently down (#948). */
export interface LiveEvents {
  events: FrameworkEvent[]
  /** True while the stream is lost and being retried — the feed may be behind reality. */
  lost: boolean
  /** The server closed the channel on purpose (relay stream ended, unknown run) — final. */
  done: boolean
}

/** Retry delays for a lost stream: quick first, then settle at a slow poll. */
const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000]

function retryDelay(attempt: number): number {
  return RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)] as number
}

/**
 * How long a reconnect waits for the server's end-of-replay marker before swapping anyway
 * (#1383). The on-disk tail sends `stream-sync` the moment its replay is delivered, so this
 * deadline only fires for the in-memory sources (relay #426, relayed device runs #1067),
 * which have no replay boundary to report — their buffered history streams in well under it.
 */
const SYNC_GRACE_MS = 1500

export function useLiveEvents(projectId: string | null, agentId?: string | null, resetKey?: unknown): LiveEvents {
  const [events, setEvents] = useState<FrameworkEvent[]>([])
  const [lost, setLost] = useState(false)
  const [done, setDone] = useState(false)

  // Drop the accumulated feed at a run boundary the caller knows about (a fresh Start bumps
  // `resetKey`), WITHOUT tearing down the subscription. The new run truncates events.jsonl a
  // beat later, so until its first line streams the buffer would otherwise still hold the
  // finished run — which the jump-to-live view (#705) would show. Clearing here means the pane
  // waits empty for the new run instead. The live tail then re-reads the truncated file on its
  // own (JsonlTailer rewrite detection) and streams the new run in.
  useEffect(() => {
    setEvents([])
  }, [resetKey])

  useEffect(() => {
    setEvents([])
    setLost(false)
    setDone(false)
    if (!projectId) return
    let channel: EventChannel | undefined
    let cancelled = false
    let attempt = 0
    let first = true
    let timer: ReturnType<typeof setTimeout> | undefined
    let graceTimer: ReturnType<typeof setTimeout> | undefined

    // A dead stream used to be silent: the daemon restarts, events just stop, and "the agent
    // went quiet" is indistinguishable from "the feed died" (#948). Now an errored close (or a
    // failed subscribe) flips `lost` and retries with backoff. A clean close is the server being
    // done with the channel on purpose (relay stream ended, unknown project) — not an outage —
    // so it neither retries nor alarms, matching the old behavior.
    const retry = () => {
      if (cancelled) return
      setLost(true)
      timer = setTimeout(subscribe, retryDelay(attempt++))
    }

    const subscribe = () => {
      // Every subscribe replays the whole log before following live. The FIRST one streams into
      // a pane this effect just cleared, so it renders as it arrives. A RECONNECT has a populated
      // feed on screen, and blanking it while history re-streamed was #1383's mid-run flicker:
      // the lost banner cleared on resubscribe, then the feed sat empty until the replay caught
      // up. So a reconnect buffers the replay and swaps atomically — on the server's stream-sync
      // marker, or at a grace deadline for the in-memory sources that send none. The feed never
      // shows less than it already showed (#1402's rule, applied to the live channel).
      const reconnect = !first
      first = false
      void onEvents(projectId, agentId ?? undefined).then(ch => {
        if (cancelled) {
          void ch.close()
          return
        }
        channel = ch
        attempt = 0
        setLost(false)
        let buffer: FrameworkEvent[] | undefined = reconnect ? [] : undefined
        const swap = () => {
          if (cancelled || buffer === undefined) return
          const replay = buffer
          buffer = undefined
          setEvents(replay)
        }
        if (reconnect) graceTimer = setTimeout(swap, SYNC_GRACE_MS)
        else setEvents([]) // fresh subscribe: start clean so the replay is not appended twice
        ch.listen(event => {
          if (event.kind === 'stream-sync') {
            swap()
            return
          }
          stampReceived(event)
          if (buffer) buffer.push(event)
          else setEvents(prev => [...prev, event])
        })
        ch.onClose(err => {
          // A close mid-replay drops the partial buffer: swapping it in would be exactly the
          // collapse this exists to prevent, and the next attempt replays from the top anyway.
          buffer = undefined
          if (graceTimer) clearTimeout(graceTimer)
          if (err) retry()
          else if (!cancelled) setDone(true)
        })
      }, retry)
    }

    subscribe()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      if (graceTimer) clearTimeout(graceTimer)
      void channel?.close()
    }
    // agentId is a dependency: selecting another run must resubscribe to that run's log (#749).
  }, [projectId, agentId])

  // Scope the accumulated feed to the run in progress — but only for the project-root fallback:
  // that subscription lives across run boundaries (it only resets on a project switch), so
  // without the slice a second run would show the previous run's log until it finished. A run's
  // own tail (#749) holds nothing but that run — including the second `session` boundary a
  // resumed session (#762) appends to the SAME journal, where slicing is exactly wrong: it hid
  // everything before the resume for as long as the run was live. See {@link currentAgentEvents}.
  const scoped = useMemo(() => (agentId ? events : currentAgentEvents(events)), [events, agentId])
  return { events: scoped, lost, done }
}
