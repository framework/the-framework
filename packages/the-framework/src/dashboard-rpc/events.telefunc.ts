import type { ClientChannel } from 'telefunc'
import { resolveRunEventsPath } from '../store/index.js'
import { contextEventsSource, resolveProjectPath } from './context.js'
import type { FrameworkEvent } from '../events.js'
import { tailRunEvents } from './events-tail.js'
import { forwardStream, streamChannel } from './stream-channel.js'

// The live event stream behind the new dashboard (#405): the selected project's run,
// read straight from the same `.the-framework/events.jsonl` the daemon writes. Each new
// JSONL line becomes one `channel.send(event)`, so the file watcher maps 1:1 onto a
// Telefunc Channel — serialization, type validation, and reconnect come for free. Runs,
// docs, and the project log come over the read-model RPCs (reads.telefunc.ts).

/**
 * The events file to tail, or undefined when the project is unknown. With a `runId` this is
 * that run's own log inside its worktree (#749): since #736 a run appends there, not to the
 * project root, so streaming the project path would follow a file nothing writes to. Once the
 * run has ended and its worktree is gone, the run's archived `<id>.jsonl` is that log (#1472) —
 * tailing the project root there would stream a foreign run's journal.
 */
async function resolveEventsPath(projectId: string, runId?: string): Promise<string | undefined> {
  const cwd = await resolveProjectPath(projectId)
  return cwd ? resolveRunEventsPath(cwd, runId) : undefined
}

/**
 * The end-of-replay marker (#1383). A subscribe replays the whole log before following live,
 * and without a boundary a reconnecting client cannot tell "replay still streaming" from "the
 * log is genuinely this short" — so it blanked a populated feed and refilled it line by line.
 * Sent once per subscription, after the on-disk replay is delivered. Wire-only: it is not a
 * {@link FrameworkEvent}, is never written to any journal, and the client swallows it.
 */
export type StreamSync = { kind: 'stream-sync' }

/** What `onEvents` streams: the run's events, plus the wire-only end-of-replay marker. */
export type LiveFeedEvent = FrameworkEvent | StreamSync

/**
 * `onEvents(projectId, runId?)` returns a Channel that streams one live run: the client
 * `.listen()`s for `FrameworkEvent`s and `.close()`s to unsubscribe, which stops the tail.
 * An unknown project yields a channel that closes immediately (mirrors the read model's
 * empty results rather than throwing at the client).
 *
 * Pass the `runId` to follow that run's own log (#749). A project has several concurrent
 * runs since #736, each writing inside its worktree, so the run id is what makes the feed
 * that run's rather than a mix — and without it the feed for a worktree run is empty.
 * Omitting it keeps the pre-#736 behavior of tailing the project root.
 *
 * Two sources, chosen by the mount. An in-memory stream on the context wins: the relay's own run
 * (#426), or a run the daemon is relaying from a device (#1067). Otherwise the on-disk log. The
 * daemon sets a source that answers only for relayed runs, so an ordinary local run yields undefined
 * here and falls through to tailing the log, exactly as before.
 *
 * Only the on-disk tail sends the {@link StreamSync} marker: the in-memory sources have no
 * replay boundary to report, so a reconnecting client falls back to a grace deadline before
 * swapping its feed (see use-live-events in the dashboard).
 */
export async function onEvents(projectId: string, runId?: string): Promise<ClientChannel<never, LiveFeedEvent>> {
  const stream = contextEventsSource()?.(projectId, runId)
  if (stream) {
    // An in-memory run: replay + follow it, mirroring how serveSSE consumes it.
    return streamChannel<LiveFeedEvent>(send => forwardStream(stream, send))
  }
  // Everywhere else: tail the run's on-disk events.jsonl (undefined path -> closed channel).
  // The relocating tail, because the journal moves mid-subscription: teardown copies it into the
  // archive and removes the worktree, and a fixed-path tail whose fs.watch missed the final
  // appends went silent without the run's `end`. On the move it re-resolves (the archive, #1472)
  // and carries its offset, so the feed gets exactly the lines the move would have swallowed.
  const path = await resolveEventsPath(projectId, runId)
  // The one place a run-scoped feed must NOT relocate to: the project-root journal, which is
  // resolveRunEventsPath's last-resort fallback once a Delete has removed worktree and archive
  // alike — it is another run's feed (#1472). A deleted session's tab goes quiet instead. The
  // initial attach stays permissive: a fallback run (non-git project) legitimately lives there.
  const rootJournal = runId === undefined ? undefined : await resolveEventsPath(projectId, undefined)
  let initial = true
  return streamChannel<LiveFeedEvent>(send =>
    path
      ? tailRunEvents(
          async () => {
            const next = await resolveEventsPath(projectId, runId)
            if (initial) {
              initial = false
              return next
            }
            return rootJournal !== undefined && next === rootJournal ? undefined : next
          },
          send,
          () => send({ kind: 'stream-sync' }),
        )
      : undefined,
  )
}
