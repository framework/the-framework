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
 * The one first segment that names a view rather than a project (#958): the dashboard's own
 * settings. Every other bare word is a widget's page (#1774): the dashboard reserves nothing else,
 * not even for the tickets, whose pages are their package's widget's.
 *
 * Safe to reserve because a project id is never this word: the registry builds one as
 * `<slugified basename>-<hash in base36>`, so every real id carries a `-<hash>` suffix.
 */
const SETTINGS_SEGMENT = 'settings'

/**
 * Whether a first segment names a page a widget adds (#1774) rather than a project: a lowercase
 * letter, then lowercase letters and digits. Never a project's id, which always carries a
 * `-<hash>` suffix, so the router reserves no widget's word: whichever widget claims the segment
 * gets it, and the shell says "no such page" when none does.
 */
export function isPageSegment(segment: string): boolean {
  return /^[a-z][a-z0-9]*$/.test(segment)
}

/** What the dashboard is looking at, as carried by the URL. */
export interface Route {
  /** A top-level view belonging to no project (#958). */
  view?: 'settings'
  /** The selected project, or null for the Overview. */
  projectId: string | null
  /** The selected session (agent id), or null for the project's home/launcher. */
  agentId: string | null
  /** A widget's page (#1774), by its segment; no project and no agent is selected there. */
  page?: string
  /** The segments after a widget page's own, decoded: `/logs/a` carries `['a']`. */
  pagePath?: string[]
}

/** Read the route out of a path. Anything unparseable is the Overview, and extra segments are ignored. */
export function parseRoute(pathname: string): Route {
  const segments = pathname.split('/').filter(Boolean).map(decodeSegment)
  const [first, second] = segments
  if (first === SETTINGS_SEGMENT) return { view: 'settings', projectId: null, agentId: null }
  if (!first) return { projectId: null, agentId: null }
  if (isPageSegment(first)) return { projectId: null, agentId: null, page: first, pagePath: segments.slice(1) }
  return { projectId: first, agentId: second ?? null }
}

/** The path for a route — the inverse of {@link parseRoute}. */
export function formatRoute({ view, projectId, agentId, page, pagePath }: Route): string {
  if (view === 'settings') return `/${SETTINGS_SEGMENT}`
  if (page) return ['', page, ...(pagePath ?? [])].map(encodeURIComponent).join('/')
  if (!projectId) return '/'
  const project = encodeURIComponent(projectId)
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
