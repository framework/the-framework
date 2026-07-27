// How a queue entry reads on screen (#1164).
//
// Entries are lines of `TODO_AGENTS.md`, so they are markdown, and since #1164 a ticket queued
// from the dashboard is written as a link back to its ticket. The Overview's card printed the line
// verbatim, so what the reader got was source: `[Improve tooltip: show it with no...`. Agents also
// append their own notes after the link, which pushed the title out of a truncated single line
// entirely — the queue looked broken because it was unreadable, not because it was empty.

/** A queue entry split into what to show and where it points. */
export interface QueueEntryLabel {
  /** The human part: the link's text, else the line itself. */
  text: string
  /**
   * The ticket the entry links to, when it is a link into `tickets/`. The bare filename — the
   * key `WorkspaceTicket.file` uses — so the consumer can open the ticket's own page with it.
   */
  ticket?: string
  /** The link's absolute http(s) target, when the entry points out of the workspace instead. */
  url?: string
}

/** `[title](target)` at the start of a line, with the title allowed to contain anything but `]`. */
const LEADING_LINK = /^\s*\[([^\]]+)\]\(([^)\s]+)\)\s*/

/** Where a queued ticket's link points (#1164) — same prefix `sendQueueTicket` writes. */
const TICKET_PREFIX = 'tickets/'

/**
 * What one queue entry should read as, and where it points.
 *
 * Only a link at the START of the entry counts as its title: that is where {@link sendQueueTicket}
 * writes it, and a link further in is part of a sentence rather than the name of the work. Anything
 * after the link is the agent's own note, which is detail — it belongs in the tooltip, not in a
 * one-line list that would truncate the title away to show it.
 *
 * The target is classified the way the Overview's `queuedTicketFile` (overview.ts) classifies it:
 * only one under `tickets/` names a ticket. An absolute http(s) target is kept as `url`; any other
 * target (a bare repo path like `README.md`) has no page of its own in the dashboard, so the entry
 * keeps the link's title but points nowhere rather than at a dead destination.
 */
export function queueEntryLabel(entry: string): QueueEntryLabel {
  const link = LEADING_LINK.exec(entry)
  if (!link) return { text: entry.trim() }
  const text = link[1]!.trim()
  const target = link[2]!
  if (target.startsWith(TICKET_PREFIX)) return { text, ticket: target.slice(TICKET_PREFIX.length) }
  if (/^https?:\/\//.test(target)) return { text, url: target }
  return { text }
}
