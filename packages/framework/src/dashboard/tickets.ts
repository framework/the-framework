import { sessionNameOf } from '@gemstack/skill-branches/branch-names'
import { hasTickets as ticketsExist, readTicket as readOne, readTickets as readAll, readTicketsMeta as readMeta, ticketsDir, type Ticket, type TicketDetail, type TicketsMeta } from '@gemstack/skill-tickets'
import { readAllAgents } from '../store/index.js'

export type { TicketsMeta, TicketGithubLink } from '@gemstack/skill-tickets'

/**
 * A ticket as the dashboard shows it: the `tickets` skill's row, with the holder of its claim
 * resolved against this project's own agents (#1748). A lock names an agent id — the same id
 * the agent's checkout is named with — so a claim the daemon minted, or an agent on this machine
 * made with the `tickets` command, resolves to the agent's page and its session name; a holder
 * this project has no record of (another machine's agent, a cloud session's branch name) is
 * shown as written.
 */
export interface WorkspaceTicket extends Ticket {
  /** The agent whose id the lock names, when it is one of this project's: its id and, once named, its session name. */
  lockedByAgent?: { id: string; name?: string }
}

/** One ticket with its entire markdown, for its own page. */
export interface WorkspaceTicketDetail extends WorkspaceTicket, TicketDetail {}

/** The project's tickets, off the skill's checkout under `.branches/agent-data`, holders resolved. */
export async function readTickets(cwd: string): Promise<WorkspaceTicket[]> {
  const tickets = await readAll(ticketsDir(cwd))
  return resolveHolders(cwd, tickets)
}

/** One ticket by filename, full text included; `null` when there is no such ticket. */
export async function readTicket(cwd: string, file: string): Promise<WorkspaceTicketDetail | null> {
  const ticket = await readOne(ticketsDir(cwd), file)
  if (!ticket) return null
  const [resolved] = await resolveHolders(cwd, [ticket])
  return resolved as WorkspaceTicketDetail
}

/** Whether the project has any ticket at all (#958): a listing, for the onboarding checklist's poll. */
export async function hasTickets(cwd: string): Promise<boolean> {
  return ticketsExist(ticketsDir(cwd))
}

/** When the tickets last caught up with GitHub (#1208), or `{}` when nothing has recorded it. */
export async function readTicketsMeta(cwd: string): Promise<TicketsMeta> {
  return readMeta(ticketsDir(cwd))
}

/** The holder of every locked ticket looked up once against the project's records. */
async function resolveHolders<T extends Ticket>(cwd: string, tickets: T[]): Promise<(T & { lockedByAgent?: { id: string; name?: string } })[]> {
  if (!tickets.some(ticket => ticket.lockedBy !== undefined)) return tickets
  const agents = await readAllAgents(cwd).catch(() => [])
  return tickets.map(ticket => {
    const agent = ticket.lockedBy === undefined ? undefined : agents.find(a => a.id === ticket.lockedBy)
    if (!agent) return ticket
    const name = sessionNameOf(agent.branch, agent.id)
    return { ...ticket, lockedByAgent: { id: agent.id, ...(name ? { name } : {}) } }
  })
}
