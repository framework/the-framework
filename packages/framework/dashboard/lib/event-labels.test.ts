import { describe, expect, it } from 'vitest'
import { eventKindLabel } from './event-labels.js'

describe('eventKindLabel', () => {
  it('renames the jargon kinds to plain words', () => {
    expect(eventKindLabel('driver')).toBe('agent')
    expect(eventKindLabel('usage')).toBe('cost')
    expect(eventKindLabel('session-update')).toBe('resume')
  })

  it('leaves every other kind as its own name', () => {
    expect(eventKindLabel('session')).toBe('session')
    expect(eventKindLabel('choice')).toBe('choice')
    expect(eventKindLabel('end')).toBe('end')
  })
})
