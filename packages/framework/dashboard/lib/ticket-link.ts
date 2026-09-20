import { TICKETS_DIR, queuePriorityForTicket } from '@gemstack/skill-tickets/names'
import { planTicketPrompt } from '../../src/client.js'
import type { WidgetLink } from '../widget/index.js'

// A ticket as a link (#1774 Q3): what the tickets pages hand the actions the installed widgets
// offer on links (`components/LinkActions.tsx`). The framework knows tickets and knows links; it
// says a ticket as a link once, here, so the ticket's page and the tickets list agree on it.

/** The fields of a ticket a link is made from. */
export interface LinkableTicket {
  /** The ticket's filename inside `tickets/`, its identity. */
  file: string
  title: string
  /** Its own `priority:` key, when it has one. */
  priority?: string | undefined
}

/**
 * The ticket itself as a link: its title, pointing at its file, at the priority its own
 * `Priority:` earns on the 0–10 scale (5 when it has none or an unreadable one; the rule is the
 * tickets package's). An action on this link names the ticket, so whatever is written links back.
 */
export function ticketLink(ticket: LinkableTicket): WidgetLink {
  return { text: ticket.title, href: `${TICKETS_DIR}/${ticket.file}`, priority: queuePriorityForTicket(ticket.priority) }
}

/**
 * The ask for the ticket's plan as a link with no target: the plain sentence `Create
 * tickets/<stem>.plan.md`, at the ticket's priority. Deliberately not a link to the ticket: a
 * leading link to a ticket reads everywhere as "this ticket is queued for implementation", and a
 * plan ask must not.
 */
export function planLink(ticket: LinkableTicket): WidgetLink {
  return { text: planTicketPrompt(ticket.file), priority: queuePriorityForTicket(ticket.priority) }
}
