import type { Ticket, TicketDetail } from '../../src/widget.js'

// The tickets as the widget's pages show them: the command's rows, with the holder of a claim
// resolved against the project's runs the dashboard knows.

/** A ticket as the pages show it: the `tickets` command's row, with the run behind its claim when the lock names one. */
export interface WorkspaceTicket extends Ticket {
  /** The run whose id the lock names, when it is one of this project's: its id and, once named, its session name. */
  lockedByAgent?: { id: string; name?: string }
}

/** One ticket with its entire markdown, for its own page. */
export interface WorkspaceTicketDetail extends WorkspaceTicket, TicketDetail {}

/** One project's tickets, for the cross-project list. */
export interface ProjectTickets {
  projectId: string
  projectName: string
  tickets: WorkspaceTicket[]
}
