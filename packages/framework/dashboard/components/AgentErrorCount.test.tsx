import type { FrameworkEvent } from '../../src/index.js'
import { afterEach, describe, expect, test } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { AgentErrorCount } from './AgentErrorCount.js'

afterEach(cleanup)

// The count is the session header's half of the error capability (#1500): the log carries the
// errors themselves, this says how many there were without the reader scrolling for them.
describe('AgentErrorCount', () => {
  test('a session that reported no errors shows nothing', () => {
    const { container } = render(<AgentErrorCount events={[{ kind: 'ready-for-merge' }]} />)
    expect(container.textContent).toBe('')
  })

  test('one error reads singular, with its headline where the row has room', () => {
    render(<AgentErrorCount events={[{ kind: 'error', headline: 'gh is not logged in' }]} headline />)
    expect(screen.getByText('1 error')).toBeTruthy()
    expect(screen.getByText(/gh is not logged in/)).toBeTruthy()
  })

  test('a tight row shows the count alone — a clipped headline is worse than none', () => {
    render(<AgentErrorCount events={[{ kind: 'error', headline: 'gh is not logged in' }]} />)
    expect(screen.getByText('1 error')).toBeTruthy()
    expect(screen.queryByText(/gh is not logged in/)).toBeNull()
  })

  test('several errors read plural, and the LATEST headline is the one shown', () => {
    const events: FrameworkEvent[] = [
      { kind: 'error', headline: 'first thing broke' },
      { kind: 'error', headline: 'second thing broke' },
    ]
    render(<AgentErrorCount events={events} headline />)
    expect(screen.getByText('2 errors')).toBeTruthy()
    expect(screen.getByText(/second thing broke/)).toBeTruthy()
    expect(screen.queryByText(/first thing broke/)).toBeNull()
  })
})
