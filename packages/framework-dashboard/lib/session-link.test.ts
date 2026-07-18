import { describe, expect, it } from 'vitest'
import { describeSessionLink } from './session-link.js'

describe('describeSessionLink', () => {
  it('returns null when there is no link', () => {
    expect(describeSessionLink(null)).toBeNull()
    expect(describeSessionLink({})).toBeNull()
    expect(describeSessionLink({ sessionId: 'abc', driver: 'claude' })).toBeNull()
  })

  it('labels the generic Claude Code entry honestly and surfaces the id separately (the bug)', () => {
    const view = describeSessionLink({ sessionLink: 'https://claude.ai/code', sessionId: '532ccc4b', driver: 'claude' })
    expect(view).toEqual({ href: 'https://claude.ai/code', label: 'Open Claude Code ↗', id: '532ccc4b' })
  })

  it('keeps "Open session (id)" for a real deep link that encodes the id', () => {
    const view = describeSessionLink({ sessionLink: 'https://example.com/s/532ccc4b', sessionId: '532ccc4b', driver: 'claude' })
    expect(view).toEqual({ href: 'https://example.com/s/532ccc4b', label: 'Open session (532ccc4b) ↗', id: null })
  })

  it('does not claim a session before the id is reported', () => {
    const view = describeSessionLink({ sessionLink: 'https://claude.ai/code', driver: 'claude' })
    expect(view).toEqual({ href: 'https://claude.ai/code', label: 'Open Claude Code ↗', id: null })
  })

  it('for a non-Claude custom link, shows a neutral label plus the id', () => {
    const view = describeSessionLink({ sessionLink: 'https://foo.test', sessionId: 'x1', driver: 'codex' })
    expect(view).toEqual({ href: 'https://foo.test', label: 'Open session ↗', id: 'x1' })
  })
})
