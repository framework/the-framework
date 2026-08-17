import { describe, expect, test } from 'vitest'
import { parsePriority, priorityTone } from './ticket-priority.js'

describe('ticket-priority (#1144/#1265)', () => {
  test('parses a numeric priority string', () => {
    expect(parsePriority('7')).toBe(7)
    expect(parsePriority('0')).toBe(0)
  })

  test('an absent or unparseable priority is undefined, not NaN', () => {
    expect(parsePriority(undefined)).toBe(undefined)
    expect(parsePriority('urgent')).toBe(undefined)
  })

  test('tone reads red past 8, amber past 5, muted below and when absent', () => {
    expect(priorityTone('10')).toBe('text-danger')
    expect(priorityTone('8')).toBe('text-danger')
    expect(priorityTone('7')).toBe('text-warning')
    expect(priorityTone('5')).toBe('text-warning')
    expect(priorityTone('4')).toBe('text-muted-foreground')
    expect(priorityTone('0')).toBe('text-muted-foreground')
    expect(priorityTone(undefined)).toBe('text-muted-foreground')
  })
})
