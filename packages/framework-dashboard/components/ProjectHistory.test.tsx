import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'

// The section polls onProjectLog itself (the ProjectTickets pattern); ProjectLogPanel renders
// what it is given.
const onProjectLog = vi.hoisted(() => vi.fn())
vi.mock('../server/reads.telefunc.js', () => ({ onProjectLog }))

const { ProjectHistory } = await import('./ProjectHistory.js')

beforeEach(() => {
  onProjectLog.mockReset().mockResolvedValue([])
})

afterEach(cleanup)

describe('ProjectHistory (#1455 item 3)', () => {
  test('a project with no finished sessions gets no section at all', async () => {
    const { container } = render(<ProjectHistory projectId="p1" />)
    await waitFor(() => expect(onProjectLog).toHaveBeenCalledWith('p1'))
    expect(container.textContent).toBe('')
  })

  test('log entries render under a History heading in the ProjectLogPanel presentation', async () => {
    onProjectLog.mockResolvedValue([{ kind: 'prompt', status: 'done', at: '2026-07-25T00:00:00.000Z', title: 'add a haiku' }])
    render(<ProjectHistory projectId="p1" />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'History' })).toBeTruthy())
    expect(screen.getByText('add a haiku')).toBeTruthy()
  })
})
