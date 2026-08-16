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

  it('reads the cross-project Tickets list, which belongs to no project (#1144)', () => {
    expect(parseRoute('/tickets')).toEqual({ view: 'tickets', projectId: null, agentId: null })
    // Trailing slash and stray segments are the same page, like every other route.
    expect(parseRoute('/tickets/')).toEqual({ view: 'tickets', projectId: null, agentId: null })
    expect(parseRoute('/tickets/anything')).toEqual({ view: 'tickets', projectId: null, agentId: null })
  })

  it('leaves every other first segment a project, so only the reserved word is taken (#1144)', () => {
    expect(parseRoute('/tickets-a1b2')).toEqual({ projectId: 'tickets-a1b2', agentId: null })
    expect(parseRoute('/my-tickets')).toEqual({ projectId: 'my-tickets', agentId: null })
  })

  it('reads a project\'s tickets page, as its own view rather than a session (#1144)', () => {
    expect(parseRoute('/my-repo-a1b2/tickets')).toEqual({ view: 'tickets', projectId: 'my-repo-a1b2', agentId: null, ticketSlug: null })
    // Trailing slash is the same page, like every other route.
    expect(parseRoute('/my-repo-a1b2/tickets/')).toEqual({ view: 'tickets', projectId: 'my-repo-a1b2', agentId: null, ticketSlug: null })
  })

  it('leaves every other second segment a session, so only the reserved word is taken (#1144)', () => {
    // A run id is derived from its start time, so it can never be the bare reserved word — but
    // anything merely starting with it still has to route to a session.
    expect(parseRoute('/my-repo/tickets-ab')).toEqual({ projectId: 'my-repo', agentId: 'tickets-ab' })
  })

  it('reads one ticket\'s detail page, by the same slug as its filename (#1144)', () => {
    expect(parseRoute('/my-repo-a1b2/tickets/2026-07-20_do-the-thing.md')).toEqual({
      view: 'tickets',
      projectId: 'my-repo-a1b2',
      agentId: null,
      ticketSlug: '2026-07-20_do-the-thing.md',
    })
    // A stray segment past the slug is ignored, like every other route.
    expect(parseRoute('/my-repo-a1b2/tickets/2026-07-20_do-the-thing.md/whatever')).toEqual({
      view: 'tickets',
      projectId: 'my-repo-a1b2',
      agentId: null,
      ticketSlug: '2026-07-20_do-the-thing.md',
    })
  })

  it('reads a ticket\'s plan view off the fourth segment', () => {
    expect(parseRoute('/my-repo-a1b2/tickets/2026-07-20_do-the-thing.md/plan')).toEqual({
      view: 'tickets',
      projectId: 'my-repo-a1b2',
      agentId: null,
      ticketSlug: '2026-07-20_do-the-thing.md',
      plan: true,
    })
    // As the third segment, `plan` is just the ticket slug — it only turns on the plan view when
    // it is the fourth, sitting past a real slug.
    expect(parseRoute('/my-repo-a1b2/tickets/plan')).toEqual({
      view: 'tickets',
      projectId: 'my-repo-a1b2',
      agentId: null,
      ticketSlug: 'plan',
    })
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

  it('writes the cross-project Tickets list when no project is given (#1144)', () => {
    expect(formatRoute({ view: 'tickets', projectId: null, agentId: null })).toBe('/tickets')
  })

  it('writes a project\'s tickets page, and it outranks a stale session id (#1144)', () => {
    expect(formatRoute({ view: 'tickets', projectId: 'my-repo', agentId: null })).toBe('/my-repo/tickets')
    expect(formatRoute({ view: 'tickets', projectId: 'my-repo', agentId: 'run-1' })).toBe('/my-repo/tickets')
  })

  it('writes one ticket\'s detail page, slug encoded (#1144)', () => {
    expect(formatRoute({ view: 'tickets', projectId: 'my-repo', agentId: null, ticketSlug: '2026-07-20_do-the-thing.md' })).toBe(
      '/my-repo/tickets/2026-07-20_do-the-thing.md',
    )
    expect(formatRoute({ view: 'tickets', projectId: 'my-repo', agentId: null, ticketSlug: 'a b.md' })).toBe('/my-repo/tickets/a%20b.md')
  })

  it('writes a ticket\'s plan view, slug encoded, past its detail path', () => {
    expect(formatRoute({ view: 'tickets', projectId: 'my-repo', agentId: null, ticketSlug: '2026-07-20_do-the-thing.md', plan: true })).toBe(
      '/my-repo/tickets/2026-07-20_do-the-thing.md/plan',
    )
    // No slug, nothing to plan against — the flag is dropped rather than writing a dangling `/plan`.
    expect(formatRoute({ view: 'tickets', projectId: 'my-repo', agentId: null, ticketSlug: null, plan: true })).toBe('/my-repo/tickets')
  })

  it('round-trips', () => {
    for (const route of [
      { projectId: null, agentId: null },
      { projectId: 'my-repo', agentId: null },
      { projectId: 'my-repo', agentId: 'run-1' },
      { projectId: 'a b', agentId: 'c/d' },
      { view: 'settings' as const, projectId: null, agentId: null },
      { view: 'tickets' as const, projectId: null, agentId: null },
      { view: 'tickets' as const, projectId: 'my-repo', agentId: null, ticketSlug: null },
      { view: 'tickets' as const, projectId: 'my-repo', agentId: null, ticketSlug: '2026-07-20_thing.md' },
      { view: 'tickets' as const, projectId: 'my-repo', agentId: null, ticketSlug: '2026-07-20_thing.md', plan: true },
    ]) {
      expect(parseRoute(formatRoute(route))).toEqual(route)
    }
  })
})
