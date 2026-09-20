import { describe, it, expect } from 'vitest'
import { parseRoute, formatRoute } from './route.js'

describe('parseRoute', () => {
  it('reads the Overview from the root', () => {
    expect(parseRoute('/')).toEqual({ projectId: null, agentId: null })
    expect(parseRoute('')).toEqual({ projectId: null, agentId: null })
  })

  it('reads a project home', () => {
    expect(parseRoute('/my-repo-a1b2')).toEqual({ projectId: 'my-repo-a1b2', agentId: null })
  })

  it('reads a session', () => {
    expect(parseRoute('/my-repo-a1b2/2026-07-19-1200-ab')).toEqual({
      projectId: 'my-repo-a1b2',
      agentId: '2026-07-19-1200-ab',
    })
  })

  it('ignores a trailing slash and extra segments', () => {
    expect(parseRoute('/my-repo/run-1/')).toEqual({ projectId: 'my-repo', agentId: 'run-1' })
    expect(parseRoute('/my-repo/run-1/whatever')).toEqual({ projectId: 'my-repo', agentId: 'run-1' })
  })

  it('decodes segments, and keeps a malformed one as typed', () => {
    expect(parseRoute('/a%20b/c%2Fd')).toEqual({ projectId: 'a b', agentId: 'c/d' })
    expect(parseRoute('/%E0%A4%A')).toEqual({ projectId: '%E0%A4%A', agentId: null })
  })

  it('reads no tickets view: `/tickets` is a widget page like any other bare word (#1774)', () => {
    expect(parseRoute('/tickets')).toEqual({ projectId: null, agentId: null, page: 'tickets', pagePath: [] })
    expect(parseRoute('/tickets/my-repo-a1b2/2026-07-20_do-the-thing.md/plan')).toEqual({
      projectId: null,
      agentId: null,
      page: 'tickets',
      pagePath: ['my-repo-a1b2', '2026-07-20_do-the-thing.md', 'plan'],
    })
    // Under a project, `tickets` is an agent id like any other second segment.
    expect(parseRoute('/my-repo-a1b2/tickets')).toEqual({ projectId: 'my-repo-a1b2', agentId: 'tickets' })
  })

  it('reads the settings page, which belongs to no project (#958)', () => {
    expect(parseRoute('/settings')).toEqual({ view: 'settings', projectId: null, agentId: null })
    // Trailing slash and stray segments are the same page, like every other route.
    expect(parseRoute('/settings/')).toEqual({ view: 'settings', projectId: null, agentId: null })
    expect(parseRoute('/settings/anything')).toEqual({ view: 'settings', projectId: null, agentId: null })
  })

  it('leaves every other first segment a project, so only the reserved word is taken (#958)', () => {
    // A generated project id is `<name>-<hash>`, so it can never be the bare reserved word —
    // but anything merely starting with it still has to route to a project.
    expect(parseRoute('/settings-a1b2')).toEqual({ projectId: 'settings-a1b2', agentId: null })
    expect(parseRoute('/my-settings')).toEqual({ projectId: 'my-settings', agentId: null })
  })
})

describe('formatRoute', () => {
  it('writes each route', () => {
    expect(formatRoute({ projectId: null, agentId: null })).toBe('/')
    expect(formatRoute({ projectId: 'my-repo', agentId: null })).toBe('/my-repo')
    expect(formatRoute({ projectId: 'my-repo', agentId: 'run-1' })).toBe('/my-repo/run-1')
  })

  it('has no session without a project', () => {
    expect(formatRoute({ projectId: null, agentId: 'run-1' })).toBe('/')
  })

  it('encodes segments', () => {
    expect(formatRoute({ projectId: 'a b', agentId: 'c/d' })).toBe('/a%20b/c%2Fd')
  })

  it('writes the settings page, and it outranks a stale project id (#958)', () => {
    expect(formatRoute({ view: 'settings', projectId: null, agentId: null })).toBe('/settings')
    expect(formatRoute({ view: 'settings', projectId: 'my-repo', agentId: 'run-1' })).toBe('/settings')
  })

  it('round-trips', () => {
    for (const route of [
      { projectId: null, agentId: null },
      { projectId: 'my-repo', agentId: null },
      { projectId: 'my-repo', agentId: 'run-1' },
      { projectId: 'a b', agentId: 'c/d' },
      { view: 'settings' as const, projectId: null, agentId: null },
      { projectId: null, agentId: null, page: 'tickets', pagePath: ['my-repo', '2026-07-20_thing.md', 'plan'] },
      { projectId: null, agentId: null, page: 'logs', pagePath: [] },
      { projectId: null, agentId: null, page: 'logs', pagePath: ['a b', 'c'] },
    ]) {
      expect(parseRoute(formatRoute(route))).toEqual(route)
    }
  })

  it('a first segment with no dash names a widget\'s page, never a project (#1774)', () => {
    expect(parseRoute('/logs')).toEqual({ projectId: null, agentId: null, page: 'logs', pagePath: [] })
    expect(parseRoute('/logs/run-1')).toEqual({ projectId: null, agentId: null, page: 'logs', pagePath: ['run-1'] })
    // A project id always has its `-<hash>`, and the one view word stays a view.
    expect(parseRoute('/my-repo')).toEqual({ projectId: 'my-repo', agentId: null })
    expect(parseRoute('/settings')).toEqual({ view: 'settings', projectId: null, agentId: null })
    expect(formatRoute({ projectId: null, agentId: null, page: 'logs' })).toBe('/logs')
  })
})
