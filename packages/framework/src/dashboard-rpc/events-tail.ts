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

/** Where a relocating tail reads now: a file it follows, a finished run's lines, whole, or nowhere yet (`pending`: ask again shortly). */
export type TailTarget<T> = { file: string } | { finished: T[] } | { pending: true }

/**
 * Tail a run's diary across its relocations: the same read-then-follow as {@link tailEvents},
 * but where the diary is is asked again whenever the tailed file is not there.
 *
 * A run's diary does not sit still. While the run works it is a file in the run's checkout; when
 * the run ends its tool records it and reclaims the checkout, and from then on the diary is the
 * finished run's, read whole from the project's runs provider. A fixed-path tail whose file was
 * retired went silent *without the final lines* whenever the last `fs.watch` signal was lost —
 * the 1s poll then found the file gone and had nothing to read, so the feed never learned the run
 * ended. This tail treats a missing file as the question it is: it asks `resolve` where the diary
 * is now (`resolveAgentDiary` answers the finished run once the checkout is gone, #1472). A new
 * file retargets the same tailer and follows it. A finished run's lines are the same lines the
 * file had, in the same order, so the ones past the count already delivered are sent and the tail
 * ends: a finished diary does not grow. The same file, or no answer, means the diary has not
 * moved, and the tail keeps waiting where it is. A diary that is nowhere yet (`pending`: the run
 * was started a moment ago and its tool has not made the checkout) is asked for again on the
 * same cadence until it has a home, and only then followed; the replay boundary is reported at
 * once, since there is nothing to replay. Asking even when the file was never seen matters for a
 * short run (#1774): started, ended and reclaimed between two polls, its diary was only ever
 * visible as a finished run.
 *
 * `onReplayed` keeps {@link tailEvents}' once-per-subscription contract: a relocation is not a
 * new replay boundary, so it never fires twice.
 */
export function tailAgentEvents<T = unknown>(
  resolve: () => Promise<TailTarget<T> | undefined>,
  onEvent: (event: T) => void,
  onReplayed?: () => void,
): () => void {
  let stopped = false
  let stopFollow: (() => void) | undefined
  let path: string | undefined
  let tailer: JsonlTailer<T> | undefined
  let relocating = false
  let waiting: NodeJS.Timeout | undefined
  let delivered = 0
  const deliver = (event: T): void => {
    delivered++
    onEvent(event)
  }
  /** The finished run's lines the feed has not had yet; nothing follows them. */
  const finish = (lines: T[]): void => {
    stopFollow?.()
    stopFollow = undefined
    for (const line of lines.slice(delivered)) deliver(line)
  }

  const follow = (): void => {
    if (stopped || path === undefined) return
    stopFollow = followFile(dirname(path), pullOrRelocate, { pollMs: POLL_MS })
  }

  const relocate = async (): Promise<void> => {
    const next = await resolve()
    // No answer, nowhere yet, or the same file: not moved (or not visible yet) — keep polling the current home.
    if (stopped || !tailer || next === undefined || 'pending' in next) return
    if ('finished' in next) return finish(next.finished)
    if (next.file === path) return
    stopFollow?.()
    path = next.file
    tailer.retarget(next.file)
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

  /** Follow `file` from its start: what is there is the replay, and appends follow. */
  const begin = (file: string, onReplayedOnce: () => void): void => {
    path = file
    tailer = new JsonlTailer<T>(file, deliver)
    const replayed = (): void => {
      if (stopped) return
      onReplayedOnce()
      follow()
    }
    void tailer.pull().then(replayed, replayed)
  }

  /** The diary is nowhere yet: ask again after a poll, until it has a home. The boundary was already reported. */
  const awaitDiary = (): void => {
    if (stopped) return
    waiting = setTimeout(() => {
      waiting = undefined
      void resolve().then(
        next => {
          if (stopped) return
          if (next === undefined || 'pending' in next) return awaitDiary()
          if ('finished' in next) return finish(next.finished)
          begin(next.file, () => {})
        },
        () => awaitDiary(),
      )
    }, POLL_MS)
    waiting.unref?.()
  }

  void resolve().then(
    initial => {
      if (stopped) return
      // No journal to speak of (unknown project): honor the replay contract and stay silent.
      if (initial === undefined) {
        onReplayed?.()
        return
      }
      if ('finished' in initial) {
        finish(initial.finished)
        onReplayed?.()
        return
      }
      if ('pending' in initial) {
        onReplayed?.()
        awaitDiary()
        return
      }
      begin(initial.file, () => onReplayed?.())
    },
    () => onReplayed?.(),
  )

  return () => {
    stopped = true
    if (waiting) clearTimeout(waiting)
    stopFollow?.()
  }
}
