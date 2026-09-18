import { existsSync } from 'node:fs'
import { dirname } from 'node:path'
import { JsonlTailer, followFile } from '../jsonl-tail.js'

/** How often the poll backstop re-reads the log when `fs.watch` says nothing. */
const POLL_MS = 1000

/**
 * Tail a JSONL log: read what is already in it, then follow appends. Each complete line is
 * parsed and handed to `onEvent`; malformed lines are skipped. Returns a stop function that
 * removes the watcher and the poll.
 *
 * The reading is {@link JsonlTailer} and the following is {@link followFile}. This used to be
 * its own copy of both, which is how it ended up missing the tailer's same-length-rewrite
 * detection (#567).
 *
 * `onReplayed` is told once the first pull — the replay of everything already logged — has
 * been delivered (#1383). That boundary is what lets a reconnecting client buffer the replay
 * and swap its feed atomically instead of blanking while history re-streams. The follower
 * only starts after it, so no appended line can slip in ahead of the marker. Best-effort on
 * a failed first read: the marker still fires (the poll retries the read), because a client
 * waiting on it forever would freeze its feed.
 *
 * Kept transport-agnostic (a plain `onEvent` callback, not a stream) so the file
 * side can be driven on its own; `events.ts` wires it to the SSE endpoint.
 */
export function tailEvents<T = unknown>(path: string, onEvent: (event: T) => void, onReplayed?: () => void): () => void {
  const tailer = new JsonlTailer<T>(path, onEvent)
  let stopped = false
  let stopFollow: (() => void) | undefined
  const follow = (): void => {
    if (stopped) return
    onReplayed?.()
    stopFollow = followFile(dirname(path), () => tailer.pull(), { pollMs: POLL_MS })
  }
  void tailer.pull().then(follow, follow)
  return () => {
    stopped = true
    stopFollow?.()
  }
}

/**
 * Tail a run's diary across its relocations: the same read-then-follow as {@link tailEvents},
 * but the path is re-resolved whenever the tailed file is not there.
 *
 * A run's diary does not sit still. While the run works it is in the run's checkout; when the
 * run ends its tool records it on the data branch and reclaims the checkout; a resumed run
 * writes on in a checkout again. A fixed-path tail whose file was retired went silent *without
 * the final lines* whenever the last `fs.watch` signal was lost — the 1s poll then found the
 * file gone and had nothing to read, so the feed never learned the run ended. This tail treats
 * a missing file as the question it is: it asks `resolvePath` where the diary lives now
 * (`resolveAgentEventsPath` answers the record once the checkout is gone, #1472), and on a
 * new answer retargets the same tailer — the copy is content-identical, so the offset carries
 * and nothing is replayed — and follows the new home. The same answer means the run has not
 * made its checkout yet, and the tail keeps waiting there. Asking even when the file was never
 * seen matters for a short run (#1774): started, ended and reclaimed between two polls, its
 * diary was only ever visible at its second home.
 *
 * `onReplayed` keeps {@link tailEvents}' once-per-subscription contract: a relocation is not a
 * new replay boundary, so it never fires twice.
 */
export function tailAgentEvents<T = unknown>(
  resolvePath: () => Promise<string | undefined>,
  onEvent: (event: T) => void,
  onReplayed?: () => void,
): () => void {
  let stopped = false
  let stopFollow: (() => void) | undefined
  let path: string | undefined
  let tailer: JsonlTailer<T> | undefined
  let relocating = false

  const follow = (): void => {
    if (stopped || path === undefined) return
    stopFollow = followFile(dirname(path), pullOrRelocate, { pollMs: POLL_MS })
  }

  const relocate = async (): Promise<void> => {
    const next = await resolvePath()
    // Same answer or none: not moved (or not visible yet) — keep polling the current home.
    if (stopped || !tailer || next === undefined || next === path) return
    stopFollow?.()
    path = next
    tailer.retarget(next)
    await tailer.pull()
    follow()
  }

  const pullOrRelocate = async (): Promise<void> => {
    if (stopped || !tailer || path === undefined) return
    if (existsSync(path)) {
      await tailer.pull()
      return
    }
    if (relocating) return
    relocating = true
    try {
      await relocate()
    } finally {
      relocating = false
    }
  }

  void resolvePath().then(
    initial => {
      if (stopped) return
      // No journal to speak of (unknown project): honor the replay contract and stay silent.
      if (initial === undefined) {
        onReplayed?.()
        return
      }
      path = initial
      tailer = new JsonlTailer<T>(initial, onEvent)
      const replayed = (): void => {
        if (stopped) return
        onReplayed?.()
        follow()
      }
      void tailer.pull().then(replayed, replayed)
    },
    () => onReplayed?.(),
  )

  return () => {
    stopped = true
    stopFollow?.()
  }
}
