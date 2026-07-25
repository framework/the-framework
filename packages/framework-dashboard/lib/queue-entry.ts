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
  /** The link target, when the entry is a link into `tickets/`. */
  ticket?: string
}

/** `[title](target)` at the start of a line, with the title allowed to contain anything but `]`. */
const LEADING_LINK = /^\s*\[([^\]]+)\]\(([^)\s]+)\)\s*/

/**
 * What one queue entry should read as.
 *
 * Only a link at the START of the entry counts as its title: that is where {@link sendQueueTicket}
 * writes it, and a link further in is part of a sentence rather than the name of the work. Anything
 * after the link is the agent's own note, which is detail — it belongs in the tooltip, not in a
 * one-line list that would truncate the title away to show it.
 */
export function queueEntryLabel(entry: string): QueueEntryLabel {
  const link = LEADING_LINK.exec(entry)
  if (!link) return { text: entry.trim() }
  return { text: link[1]!.trim(), ticket: link[2]! }
}
