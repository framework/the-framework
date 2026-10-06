import { describe, expect, it } from 'vitest'
import { frameworkTitle } from './document-title.js'

describe('frameworkTitle', () => {
  it('is the bare brand with no count and no project', () => {
    expect(frameworkTitle(0)).toBe('OpenAgent')
    expect(frameworkTitle(0, null)).toBe('OpenAgent')
  })

  it('prefixes the needs-you count when there is one', () => {
    expect(frameworkTitle(2)).toBe('(2) OpenAgent')
  })

  it('scopes to the selected project', () => {
    expect(frameworkTitle(0, 'gemstack')).toBe('gemstack — OpenAgent')
  })

  it('combines the count and the project', () => {
    expect(frameworkTitle(2, 'gemstack')).toBe('(2) gemstack — OpenAgent')
  })

  it('drops the count when zero', () => {
    expect(frameworkTitle(0, 'gemstack')).toBe('gemstack — OpenAgent')
  })
})
