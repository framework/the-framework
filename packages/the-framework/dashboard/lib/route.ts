// The dashboard's address (#784): `/` is the Overview, `/{projectId}` a project's home/launcher,
// `/{projectId}/{sessionId}` one session. The URL is the selection — what used to be three pieces
// of React state guessing at each other, which is where the #761/#766/#768/#774 bugs came from.
//
// `sessionId` is the agent id (`AgentMeta.id`), not the agent's conversation id with its driver:
// only the agent id is ours, stable, and already the name of its worktree directory. The URL
// carries the id, never the word, so the segment's name here is the last "session" left of #771 —
// the buttons above it say agent (D5).
//
// Both ids are URL-safe by construction (the registry derives a project id from its path, an agent
// id from its start time), so the segments are still encoded/decoded — a URL typed by hand is input.

/**
 * The one first segment that names a view rather than a project (#958).
 *
 * Safe to reserve because a project id is never this word: the registry builds one as
 * `<slugified basename>-<hash in base36>`, so every real id carries a `-<hash>` suffix.
 */
export const SETTINGS_SEGMENT = 'settings'

/**
 * The one word that names the Tickets view (#1144), whether as the bare first segment (the
 * cross-project list — every project's backlog, one section each, no single project selected) or
 * as a project's second segment (`/{projectId}/tickets/{slug}`, one ticket's own page).
 *
 * Safe to reserve in both spots for the same reason as {@link SETTINGS_SEGMENT}: a project id
 * always carries a `-<hash>` suffix, and an agent id is derived from its start time
 * (`agentIdFromStartedAt`) — neither is ever this bare word.
 */
export const TICKETS_SEGMENT = 'tickets'

/**
 * The word that names a ticket's plan view (its `.plan.md`), the fourth segment of
 * `/{projectId}/tickets/{slug}/plan`. Reserved past a ticket slug, where it can never collide: a
 * slug is a `.md` filename, so the bare word `plan` is never one.
 */
export const PLAN_SEGMENT = 'plan'

/** What the dashboard is looking at, as carried by the URL. */
export interface Route {
  /** A top-level view belonging to no project (#958), or the Tickets view (#1144). */
  view?: 'settings' | 'tickets'
  /** The selected project, or null for the Overview — and for the cross-project Tickets list. */
  projectId: string | null
  /** The selected session (agent id), or null for the project's home/launcher. */
  agentId: string | null
  /** One ticket's own page (#1144), by filename — the same slug as `WorkspaceTicket.file`. Only
   *  meaningful with `view: 'tickets'` and a `projectId`; a ticket belongs to one project, so the
   *  cross-project list (no `projectId`) never carries one. */
  ticketSlug?: string | null
  /** One ticket's plan view: its `<slug-stem>.plan.md` rendered as markdown. Only meaningful
   *  alongside a `ticketSlug`, since a plan belongs to a ticket. */
  plan?: boolean
}

/** Read the route out of a path. Anything unparseable is the Overview, and extra segments are ignored. */
export function parseRoute(pathname: string): Route {
  const [first, second, third, fourth] = pathname.split('/').filter(Boolean).map(decodeSegment)
  if (first === SETTINGS_SEGMENT) return { view: 'settings', projectId: null, agentId: null }
  if (first === TICKETS_SEGMENT) return { view: 'tickets', projectId: null, agentId: null }
  if (!first) return { projectId: null, agentId: null }
  if (second === TICKETS_SEGMENT)
    return {
      view: 'tickets',
      projectId: first,
      agentId: null,
      ticketSlug: third ?? null,
      // The plan flag rides only on a real slug: `/tickets/plan` with no ticket names nothing.
      ...(third && fourth === PLAN_SEGMENT ? { plan: true } : {}),
    }
  return { projectId: first, agentId: second ?? null }
}

/** The path for a route — the inverse of {@link parseRoute}. */
export function formatRoute({ view, projectId, agentId: agentId, ticketSlug, plan }: Route): string {
  if (view === 'settings') return `/${SETTINGS_SEGMENT}`
  if (view === 'tickets' && !projectId) return `/${TICKETS_SEGMENT}`
  if (!projectId) return '/'
  const project = encodeURIComponent(projectId)
  if (view === 'tickets') {
    const base = `/${project}/${TICKETS_SEGMENT}`
    if (!ticketSlug) return base
    const detail = `${base}/${encodeURIComponent(ticketSlug)}`
    // The plan hangs off its ticket's detail path; without a slug there is no plan to point at.
    return plan ? `${detail}/${PLAN_SEGMENT}` : detail
  }
  return agentId ? `/${project}/${encodeURIComponent(agentId)}` : `/${project}`
}

/** A percent-encoded segment, or the raw one when it is malformed (a hand-typed URL is input). */
function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}
