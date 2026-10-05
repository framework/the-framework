import { useModuleHost, type ModulePageProps } from '@openagt/dashboard/module'
import { routeOf } from '../src/module.js'
import { TicketsPage } from './TicketsPage.js'
import { TicketDetailPage } from './TicketDetailPage.js'
import { TicketPlanPage } from './TicketPlanPage.js'
import { TicketPageShell, TicketPageNote } from './TicketPageShell.js'

/**
 * The module's one page, `/tickets`, routed on what follows: nothing is the list of every project's
 * tickets; a project and a ticket's filename (`/tickets/<project>/<file>`, where the dashboard
 * sends a link to `tickets/<file>` in that project) is that ticket's page; `plan` after those is
 * its plan. Anything else says so, with the way back.
 */
export function TicketsModulePage({ projects, path }: ModulePageProps) {
  const route = routeOf(path)
  if (route.view === 'list') return <TicketsPage projects={projects} />
  if (route.view === 'ticket') return <TicketDetailPage projectId={route.projectId} slug={route.file} />
  if (route.view === 'plan') return <TicketPlanPage projectId={route.projectId} slug={route.file} />
  return <UnknownPage />
}

function UnknownPage() {
  const host = useModuleHost()
  return (
    <TicketPageShell onBack={() => host.openPage('tickets')}>
      <TicketPageNote>No such ticket page.</TicketPageNote>
    </TicketPageShell>
  )
}
