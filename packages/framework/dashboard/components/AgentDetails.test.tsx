import { afterEach, describe, expect, test } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { FrameworkEvent } from '../../src/index.js'
import { AgentDetails } from './AgentDetails.js'

afterEach(cleanup)

const answered: FrameworkEvent = { kind: 'driver', event: { type: 'result', text: 'Done.' } }
const priced = (usd: number): FrameworkEvent => ({ kind: 'usage', costUsd: usd })
const shown = (label: string) => screen.getByText(label).nextSibling?.textContent

describe('AgentDetails', () => {
  test('before the record holds a priced or answered turn, the strip says so', () => {
    render(<AgentDetails events={[]} />)
    expect(screen.getByText(/No spend reported yet/)).toBeTruthy()
    expect(screen.queryByText('Spent')).toBeNull()
    expect(screen.queryByText('Turns')).toBeNull()
  })

  test('the spend is every priced turn added up and the turns are the answers; the record keeps no token counts, so none show', () => {
    render(<AgentDetails events={[answered, priced(0.5), answered, priced(0.25)]} />)
    expect(shown('Spent')).toBe('$0.75')
    expect(shown('Turns')).toBe('2')
    expect(screen.queryByText('Tokens')).toBeNull()
    expect(screen.queryByText('Cache')).toBeNull()
    expect(screen.queryByText(/No spend reported yet/)).toBeNull()
  })

  test('an answered turn without a price shows the turn alone', () => {
    render(<AgentDetails events={[answered]} />)
    expect(screen.queryByText('Spent')).toBeNull()
    expect(shown('Turns')).toBe('1')
  })
})
