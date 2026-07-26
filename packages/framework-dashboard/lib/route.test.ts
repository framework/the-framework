import { describe, it, expect } from 'vitest'
import { parseRoute, formatRoute } from './route.js'

describe('parseRoute', () => {
  it('reads the Overview from the root', () => {
    expect(parseRoute('/')).toEqual({ projectId: null, runId: null })
    expect(parseRoute('')).toEqual({ projectId: null, runId: null })
  })

  it('reads a project home', () => {
    expect(parseRoute('/my-repo-a1b2')).toEqual({ projectId: 'my-repo-a1b2', runId: null })
  })

  it('reads a session', () => {
    expect(parseRoute('/my-repo-a1b2/2026-07-19-1200-ab')).toEqual({
      projectId: 'my-repo-a1b2',
      runId: '2026-07-19-1200-ab',
    })
  })

  it('ignores a trailing slash and extra segments', () => {
    expect(parseRoute('/my-repo/run-1/')).toEqual({ projectId: 'my-repo', runId: 'run-1' })
    expect(parseRoute('/my-repo/run-1/whatever')).toEqual({ projectId: 'my-repo', runId: 'run-1' })
  })

  it('decodes segments, and keeps a malformed one as typed', () => {
    expect(parseRoute('/a%20b/c%2Fd')).toEqual({ projectId: 'a b', runId: 'c/d' })
    expect(parseRoute('/%E0%A4%A')).toEqual({ projectId: '%E0%A4%A', runId: null })
  })

  it('reads the settings page, which belongs to no project (#958)', () => {
    expect(parseRoute('/settings')).toEqual({ view: 'settings', projectId: null, runId: null })
    // Trailing slash and stray segments are the same page, like every other route.
    expect(parseRoute('/settings/')).toEqual({ view: 'settings', projectId: null, runId: null })
    expect(parseRoute('/settings/anything')).toEqual({ view: 'settings', projectId: null, runId: null })
  })

  it('leaves every other first segment a project, so only the reserved word is taken (#958)', () => {
    // A generated project id is `<name>-<hash>`, so it can never be the bare reserved word —
    // but anything merely starting with it still has to route to a project.
    expect(parseRoute('/settings-a1b2')).toEqual({ projectId: 'settings-a1b2', runId: null })
    expect(parseRoute('/my-settings')).toEqual({ projectId: 'my-settings', runId: null })
  })

  it('reads a project\'s tickets page, as its own view rather than a session (#1144)', () => {
    expect(parseRoute('/my-repo-a1b2/tickets')).toEqual({ view: 'tickets', projectId: 'my-repo-a1b2', runId: null, ticketSlug: null })
    // Trailing slash is the same page, like every other route.
    expect(parseRoute('/my-repo-a1b2/tickets/')).toEqual({ view: 'tickets', projectId: 'my-repo-a1b2', runId: null, ticketSlug: null })
  })

  it('leaves every other second segment a session, so only the reserved word is taken (#1144)', () => {
    // A run id is derived from its start time, so it can never be the bare reserved word — but
    // anything merely starting with it still has to route to a session.
    expect(parseRoute('/my-repo/tickets-ab')).toEqual({ projectId: 'my-repo', runId: 'tickets-ab' })
  })

  it('reads one ticket\'s detail page, by the same slug as its filename (#1144)', () => {
    expect(parseRoute('/my-repo-a1b2/tickets/2026-07-20_do-the-thing.md')).toEqual({
      view: 'tickets',
      projectId: 'my-repo-a1b2',
      runId: null,
      ticketSlug: '2026-07-20_do-the-thing.md',
    })
    // A stray segment past the slug is ignored, like every other route.
    expect(parseRoute('/my-repo-a1b2/tickets/2026-07-20_do-the-thing.md/whatever')).toEqual({
      view: 'tickets',
      projectId: 'my-repo-a1b2',
      runId: null,
      ticketSlug: '2026-07-20_do-the-thing.md',
    })
  })
})

describe('formatRoute', () => {
  it('writes each route', () => {
    expect(formatRoute({ projectId: null, runId: null })).toBe('/')
    expect(formatRoute({ projectId: 'my-repo', runId: null })).toBe('/my-repo')
    expect(formatRoute({ projectId: 'my-repo', runId: 'run-1' })).toBe('/my-repo/run-1')
  })

  it('has no session without a project', () => {
    expect(formatRoute({ projectId: null, runId: 'run-1' })).toBe('/')
  })

  it('encodes segments', () => {
    expect(formatRoute({ projectId: 'a b', runId: 'c/d' })).toBe('/a%20b/c%2Fd')
  })

  it('writes the settings page, and it outranks a stale project id (#958)', () => {
    expect(formatRoute({ view: 'settings', projectId: null, runId: null })).toBe('/settings')
    expect(formatRoute({ view: 'settings', projectId: 'my-repo', runId: 'run-1' })).toBe('/settings')
  })

  it('writes a project\'s tickets page, and it outranks a stale session id (#1144)', () => {
    expect(formatRoute({ view: 'tickets', projectId: 'my-repo', runId: null })).toBe('/my-repo/tickets')
    expect(formatRoute({ view: 'tickets', projectId: 'my-repo', runId: 'run-1' })).toBe('/my-repo/tickets')
  })

  it('writes one ticket\'s detail page, slug encoded (#1144)', () => {
    expect(formatRoute({ view: 'tickets', projectId: 'my-repo', runId: null, ticketSlug: '2026-07-20_do-the-thing.md' })).toBe(
      '/my-repo/tickets/2026-07-20_do-the-thing.md',
    )
    expect(formatRoute({ view: 'tickets', projectId: 'my-repo', runId: null, ticketSlug: 'a b.md' })).toBe('/my-repo/tickets/a%20b.md')
  })

  it('round-trips', () => {
    for (const route of [
      { projectId: null, runId: null },
      { projectId: 'my-repo', runId: null },
      { projectId: 'my-repo', runId: 'run-1' },
      { projectId: 'a b', runId: 'c/d' },
      { view: 'settings' as const, projectId: null, runId: null },
      { view: 'tickets' as const, projectId: 'my-repo', runId: null, ticketSlug: null },
      { view: 'tickets' as const, projectId: 'my-repo', runId: null, ticketSlug: '2026-07-20_thing.md' },
    ]) {
      expect(parseRoute(formatRoute(route))).toEqual(route)
    }
  })
})
