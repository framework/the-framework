// The rules of the package's dashboard widget (`../dashboard/`), kept apart from React so they
// are unit-tested like the rest of the package: how a queue entry reads on screen, and what the
// "Add to queue" action runs for the links a dashboard page hands it.

/** How one queue entry reads on a dashboard: what to show, and where it points, if anywhere. */
export interface EntryLabel {
  /** The text to show: a leading markdown link's text, else the whole entry. */
  text: string
  /** The link's target when the entry leads with a link to an absolute http(s) URL; nothing else opens anywhere. */
  url?: string
}

/** `[text](target)` at the very start of an entry: where a caller that queues a link writes it. */
const LEADING_LINK = /^\s*\[([^\]]+)\]\(([^)\s]+)\)/

/**
 * What one entry should read as. Only a link at the START of the entry is its title: that is
 * where a queued link is written, and a link further in is part of a sentence. Anything after the
 * link is a note, kept in the raw entry (shown on hover). An absolute http(s) target opens; any
 * other target (a path inside the repository) is a name the dashboard has no page for here, so
 * the label keeps the text and points nowhere.
 */
export function entryLabel(entry: string): EntryLabel {
  const link = LEADING_LINK.exec(entry)
  if (!link) return { text: entry.trim() }
  const text = link[1]!.trim()
  const target = link[2]!
  return /^https?:\/\//.test(target) ? { text, url: target } : { text }
}

/** A link as a dashboard page hands it to an action: the framework's `WidgetLink`, by structure. */
export interface LinkToQueue {
  text: string
  href?: string
  priority?: number
}

/** The line one link is queued as: a markdown link when it points somewhere, its plain text otherwise. */
export function queueLine(link: LinkToQueue): string {
  return link.href ? `[${link.text}](${link.href})` : link.text
}

/** The `queue add` command line for one link: its line, in its priority's section when it has one. */
export function addArgs(link: LinkToQueue): string[] {
  return ['add', queueLine(link), ...(link.priority !== undefined ? ['--priority', String(link.priority)] : [])]
}

/** What running one command in a project answers: the framework's `WidgetCommandResult`, by structure. */
export type CommandResult = { ok: true; output: unknown } | { ok: false; error: string }

/** What the action did: every link queued, or stopped at the first that was not, with why. */
export type AddOutcome = { ok: true } | { ok: false; error: string }

/**
 * Queue the links, in order, in one project, each as one `queue add`. Stops at the first failure:
 * a command that could not run, or one that answered a refusal (`{ ok: false, reason }`), whose
 * reason is the error. A link already queued is queued again: the caller decides what is a
 * duplicate, since only it knows what its links name.
 */
export async function addToQueue(run: (args: string[]) => Promise<CommandResult>, links: readonly LinkToQueue[]): Promise<AddOutcome> {
  for (const link of links) {
    const result = await run(addArgs(link))
    if (!result.ok) return { ok: false, error: result.error }
    const refusal = result.output as { ok?: unknown; reason?: unknown } | null
    if (refusal && typeof refusal === 'object' && refusal.ok === false)
      return { ok: false, error: typeof refusal.reason === 'string' ? `the queue refused: ${refusal.reason}` : 'the queue refused' }
  }
  return { ok: true }
}
