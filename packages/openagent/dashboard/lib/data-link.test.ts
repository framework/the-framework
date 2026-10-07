import { describe, expect, it } from 'vitest'
import { dataLinkParts, dataLinkRoute } from './data-link.js'

// A link into a project's files opens the mounted page named by its first segment (#1774), at
// `/<segment>/<projectId>/<rest…>`; with no such page mounted, it opens nothing.
describe('dataLinkRoute', () => {
  const pages = [{ segment: 'tickets' }, { segment: 'logs' }]

  it('opens the mounted page named by the first segment, with the project and the rest as its path', () => {
    expect(dataLinkRoute('p1', 'tickets/2026-01-01_x.md', pages)).toEqual({ projectId: null, agentId: null, page: 'tickets', pagePath: ['p1', '2026-01-01_x.md'] })
    expect(dataLinkRoute('p1', 'tickets/2026-01-01_x.md/plan', pages)).toEqual({ projectId: null, agentId: null, page: 'tickets', pagePath: ['p1', '2026-01-01_x.md', 'plan'] })
  })

  it('opens nothing when no page claims the segment, for an absolute URL, or for a bare file', () => {
    expect(dataLinkRoute('p1', 'tickets/2026-01-01_x.md', [{ segment: 'logs' }])).toBeUndefined()
    expect(dataLinkRoute('p1', 'https://example.com/tickets/x', pages)).toBeUndefined()
    expect(dataLinkRoute('p1', 'README.md', pages)).toBeUndefined()
    expect(dataLinkRoute('p1', '/tickets/x.md', pages)).toBeUndefined()
    expect(dataLinkRoute('p1', 'Tickets/x.md', pages)).toBeUndefined()
  })

  it('splits a path into its page segment and the rest', () => {
    expect(dataLinkParts('tickets/a/b.md')).toEqual({ segment: 'tickets', rest: ['a', 'b.md'] })
    expect(dataLinkParts('tickets/')).toBeUndefined()
  })
})
