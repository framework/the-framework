import { readProvidedCommand, runPackageCommand, type ProvidedCommand } from '@gemstack/agent-data'

/**
 * The agent queue, as the framework reads it (#1774). The framework keeps no queue and imports no
 * queue package: a project's queue comes from whichever of its packages declares that it provides
 * it — `"framework": { "queue": "<command>" }` in the package's own package.json — and the
 * framework reads it by running that command. Swap the package for another that answers the same
 * command line and prints the same shape, and nothing here changes. No package declares it: the
 * project has no queue, and the dashboard shows it none.
 *
 * The command line a provider answers, printing one JSON document and exiting 0:
 *   `<command> --local`   the open entries, in order of work, as an array of strings
 * `--local` reads the copy on this machine, no network: the framework polls.
 *
 * That is the whole contract. Writing the queue is not the framework's: a widget the queue package
 * brings acts on it through its own command (`framework/widget`'s link actions), and the framework
 * only re-reads.
 *
 * The shape, owned here: an entry is one string, the task a future agent is started with, as the
 * queue's own command prints it. A markdown link at its start names the work and where it points;
 * how a dashboard reads that is the queue package's widget's.
 */

/** A project's queue: what a provider answers, read by the framework. */
export interface QueueSource {
  /** The open entries, in order of work; `[]` when none can be read. */
  list(): Promise<string[]>
}

/** The queue of the project at `root`, or `undefined` when none of its packages provides one. */
export type QueueFor = (root: string) => Promise<QueueSource | undefined>

/** A {@link QueueFor} that also forgets what it read of one project, for when a widget just wrote there. */
export type QueueReader = QueueFor & { changed(root: string): void }

/** How long a read is reused: the dashboard polls several reads of every project's queue every few seconds, and each is a process. */
const CACHE_MS = 5_000

/** Entries read back from a provider's output: the non-empty strings of an array, trimmed; anything else is no entries. */
export function parseQueueEntries(output: unknown): string[] {
  if (!Array.isArray(output)) return []
  return output.filter((entry): entry is string => typeof entry === 'string').map(entry => entry.trim()).filter(Boolean)
}

/** The queue source over one provider command: each list one run of the command, reads cached per {@link CACHE_MS}. */
function commandQueue(root: string, command: ProvidedCommand, now: () => number): QueueSource & { drop(): void } {
  let listed: { at: number; entries: Promise<string[]> } | undefined
  return {
    drop() {
      listed = undefined
    },
    list() {
      // Concurrent reads share one process; a read that failed is not kept.
      if (listed && now() - listed.at < CACHE_MS) return listed.entries
      const read: { at: number; entries: Promise<string[]> } = { at: now(), entries: Promise.resolve([]) }
      read.entries = runPackageCommand(root, command, ['--local']).then(result => {
        if (!result.ok || !Array.isArray(result.output)) {
          if (listed === read) listed = undefined
          return []
        }
        return parseQueueEntries(result.output)
      })
      listed = read
      return read.entries
    },
  }
}

/**
 * The production {@link QueueReader}: the project's provider, looked up by its package.json, one
 * source per project kept while the same command provides — so the cache holds across the many
 * reads of one poll, and a project that installs, swaps or drops its provider is read the new way
 * within {@link CACHE_MS}. `changed(root)` forgets that project's read, so the next read runs the
 * command again: a widget's command just ran there, and may have written.
 */
export function providedQueue(now: () => number = Date.now): QueueReader {
  const sources = new Map<string, { at: number; command?: ProvidedCommand; source?: ReturnType<typeof commandQueue> }>()
  const reader: QueueFor = async root => {
    let known = sources.get(root)
    if (!known || now() - known.at >= CACHE_MS) {
      const command = await readProvidedCommand(root, 'queue').catch(() => undefined)
      const same = known?.command && command && known.command.bin === command.bin
      known = { at: now(), ...(command ? { command, source: same ? known!.source! : commandQueue(root, command, now) } : {}) }
      sources.set(root, known)
    }
    return known.source
  }
  return Object.assign(reader, { changed: (root: string) => sources.get(root)?.source?.drop() })
}

/** The framework's one reader of the queue, shared by every caller so they share its cache. */
export const projectQueue: QueueReader = providedQueue()

/** A {@link QueueFor} for a project with no provider: no queue. */
export const noQueue: QueueFor = async () => undefined
