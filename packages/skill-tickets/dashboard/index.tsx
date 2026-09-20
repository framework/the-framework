// The tickets' widget for the dashboard: the package's `./dashboard` export. It adds one page,
// Tickets, at `/tickets`: every project's backlog, one ticket's own page, and a ticket's plan; and
// one Overview card, Hot tickets: what agents hold and what is flagged high priority. Its
// data is the `tickets` command's own output, run in each project by the dashboard: the widget
// reads exactly what an agent reads with `npx tickets list`, and lifts a claim with the same
// `npx tickets release`. What the page composes with other skills — a run started, a claim's
// holder as a run, a plan's author, the actions other widgets offer on a ticket as a link —
// comes from the dashboard's own services, and names no other skill.
import { Ticket } from 'lucide-react'
import { defineWidget } from 'framework/widget'
import { TicketsWidgetPage } from './TicketsWidgetPage.js'
import { HotTicketsCard } from './HotTicketsCard.js'
import './dashboard.css'

export default defineWidget({
  pages: [{ segment: 'tickets', label: 'Tickets', icon: Ticket, Page: TicketsWidgetPage }],
  cards: [{ id: 'hot', order: 20, Card: HotTicketsCard }],
  stylesheet: 'dashboard.css',
})
