import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const sendChoice = vi.hoisted(() => vi.fn())
vi.mock('../rpc/control.js', () => ({ sendChoice }))

const { ChoicePanel } = await import('./ChoicePanel.js')

afterEach(() => {
  cleanup()
  sendChoice.mockReset()
})

const choice = {
  id: 'await-choices',
  title: 'Which database?',
  options: [
    { id: 'pg', label: 'Postgres' },
    { id: 'lite', label: 'SQLite' },
  ],
  recommended: 'pg',
}

describe('ChoicePanel', () => {
  test('an accepted pick parks the panel until the agent goes on', async () => {
    sendChoice.mockResolvedValue({ ok: true })
    const onAnswered = vi.fn()
    render(<ChoicePanel projectId="p1" agentId="r1" choice={choice} onAnswered={onAnswered} />)
    fireEvent.click(screen.getByText('SQLite'))
    await waitFor(() => expect(onAnswered).toHaveBeenCalledWith('lite'))
    expect(sendChoice).toHaveBeenCalledWith('p1', 'await-choices', 'lite', 'r1')
    expect(screen.getByRole('status').textContent).toMatch(/Choice sent/)
    expect((screen.getByText('SQLite').closest('button') as HTMLButtonElement).disabled).toBe(true)
  })

  test('a refused pick says why in the daemon\'s words, and the question stays answerable', async () => {
    sendChoice.mockResolvedValue({ ok: false, error: 'this project has no resume hook' })
    const onAnswered = vi.fn()
    render(<ChoicePanel projectId="p1" agentId="r1" choice={choice} onAnswered={onAnswered} />)
    fireEvent.click(screen.getByText('SQLite'))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('this project has no resume hook'))
    expect(onAnswered).not.toHaveBeenCalled()
    expect(screen.queryByRole('status')).toBeNull()
    expect((screen.getByText('SQLite').closest('button') as HTMLButtonElement).disabled).toBe(false)
  })
})
