import { resolveAgentEventsPath } from '../store/index.js'
import { contextEventsSource, resolveProjectPath } from './context.js'
import type { FrameworkEvent } from '../events.js'
import { tailAgentEvents } from './events-tail.js'
import { forwardStream } from './stream-forward.js'

// The live event stream behind the dashboard (#405): the selected project's run, read straight
// from the same `.the-framework/events.jsonl` the daemon writes. Each new JSONL line becomes one
// `send(event)`, which the mount writes out as one SSE frame. Runs, docs, and the project log
// come over the read-model RPCs (reads.ts).

/**
 * The events file to tail, or undefined when the project is unknown. With a `agentId` this is
 * that agent's own log inside its worktree (#749): since #736 an agent appends there, not to the
 * project root, so streaming the project path would follow a file nothing writes to. Once the
 * run has ended and its worktree is gone, the agent's archived `<id>.jsonl` is that log (#1472) —
 * tailing the project root there would stream a foreign agent's journal.
 */
async function resolveEventsPath(projectId: string, agentId?: string): Promise<string | undefined> {
  const cwd = await resolveProjectPath(projectId)
  return cwd ? resolveAgentEventsPath(cwd, agentId) : undefined
}

/**
 * The end-of-replay marker (#1383). A subscribe replays the whole log before following live,
 * and without a boundary a reconnecting client cannot tell "replay still streaming" from "the
 * log is genuinely this short" — so it blanked a populated feed and refilled it line by line.
 * Sent once per subscription, after the on-disk replay is delivered. Wire-only: it is not a
 * {@link FrameworkEvent}, is never written to any journal, and the client swallows it.
 */
export type StreamSync = { kind: 'stream-sync' }

/** What `onEvents` streams: the agent's events, plus the wire-only end-of-replay marker. */
export type LiveFeedEvent = FrameworkEvent | StreamSync

/**
 * Follow one agent's events: `send` is called per event until the returned stop function runs.
 * Returns undefined when there is nothing to stream (an unknown project), which the mount ends as
 * a clean close — mirroring the read model's empty results rather than throwing at the client.
 *
 * Pass the `agentId` to follow that agent's own log (#749). A project has several concurrent agents
 * since #736, each writing inside its worktree, so the agent id is what makes the feed that agent's
 * rather than a mix — and without it the feed for a worktree agent is empty. Omitting it keeps the
 * pre-#736 behavior of tailing the project root.
 *
 * Two sources, chosen by what is wired. An in-memory stream wins: an agent the daemon is relaying
 * from a device (#1067). Otherwise the on-disk log. The daemon's source answers only for relayed
 * runs, so an ordinary local agent falls through to tailing the log.
 *
 * Only the on-disk tail sends the {@link StreamSync} marker: the in-memory sources have no replay
 * boundary to report, so a reconnecting client falls back to a grace deadline before swapping its
 * feed (see use-live-events in the dashboard).
 */
export async function streamAgentEvents(
  projectId: string,
  agentId: string | undefined,
  send: (value: LiveFeedEvent) => void,
  onDone?: () => void,
): Promise<(() => void) | undefined> {
  const stream = contextEventsSource()(projectId, agentId)
  // An in-memory agent: replay + follow it, and end when it ends — a relayed agent that finished has
  // nothing more to say, and leaving the response open would read as a live feed gone quiet.
  if (stream) return forwardStream(stream, send, onDone)

  // Everywhere else: tail the agent's on-disk events.jsonl (undefined path -> nothing to stream).
  // The relocating tail, because the journal moves mid-subscription: teardown copies it into the
  // archive and removes the worktree, and a fixed-path tail whose fs.watch missed the final
  // appends went silent without the agent's `end`. On the move it re-resolves (the archive, #1472)
  // and carries its offset, so the feed gets exactly the lines the move would have swallowed.
  const path = await resolveEventsPath(projectId, agentId)
  if (!path) return undefined
  // The one place a run-scoped feed must NOT relocate to: the project-root journal, which is
  // resolveAgentEventsPath's last-resort fallback once a Delete has removed worktree and archive
  // alike — it is another agent's feed (#1472). A deleted session's tab goes quiet instead. The
  // initial attach stays permissive: a fallback agent (non-git project) legitimately lives there.
  const rootJournal = agentId === undefined ? undefined : await resolveEventsPath(projectId, undefined)
  let initial = true
  return tailAgentEvents(
    async () => {
      const next = await resolveEventsPath(projectId, agentId)
      if (initial) {
        initial = false
        return next
      }
      return rootJournal !== undefined && next === rootJournal ? undefined : next
    },
    send,
    () => send({ kind: 'stream-sync' }),
  )
}
