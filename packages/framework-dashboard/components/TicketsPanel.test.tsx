import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { WorkspaceTicket } from '@gemstack/the-framework'

const onTickets = vi.hoisted(() => vi.fn())
const sendQueueTicket = vi.hoisted(() => vi.fn())
const sendStart = vi.hoisted(() => vi.fn())
vi.mock('../server/reads.telefunc.js', () => ({ onTickets }))
vi.mock('../server/control.telefunc.js', () => ({ sendQueueTicket, sendStart }))

const { TicketsPanel } = await import('./TicketsPanel.js')

const ticket = (over: Partial<WorkspaceTicket> = {}): WorkspaceTicket => ({
  file: '2026-07-20_do-the-thing.md',
  title: 'Do the thing',
  summary: 'The thing is not done.',
  spiked: false,
  planned: false,
  ...over,
})

afterEach(() => {
  cleanup()
  onTickets.mockReset()
  sendQueueTicket.mockReset()
  sendStart.mockReset()
})

describe('TicketsPanel (#697)', () => {
  test('lists the tickets with what has already been done to them', async () => {
    onTickets.mockResolvedValue([ticket({ priority: 'high', planned: true })])
    render(<TicketsPanel projectId="p1" />)
    expect(await screen.findByText('Do the thing')).toBeTruthy()
    expect(screen.getByText('The thing is not done.')).toBeTruthy()
    expect(screen.getByText('high')).toBeTruthy()
    expect(screen.getByText('planned')).toBeTruthy()
  })

  test('queueing a ticket writes it to the queue', async () => {
    onTickets.mockResolvedValue([ticket()])
    sendQueueTicket.mockResolvedValue({ ok: true, file: 'TODO_AGENTS.md' })
    render(<TicketsPanel projectId="p1" />)
    fireEvent.click(await screen.findByRole('button', { name: /queue/i }))
    await waitFor(() => expect(sendQueueTicket).toHaveBeenCalledWith('p1', 'Do the thing'))
  })

  // The queue is a file, so a re-poll cannot tell us the row was queued: without remembering
  // the click the button would invite the same entry to be added twice.
  test('a queued ticket says so and cannot be queued twice', async () => {
    onTickets.mockResolvedValue([ticket()])
    sendQueueTicket.mockResolvedValue({ ok: true, file: 'TODO_AGENTS.md' })
    render(<TicketsPanel projectId="p1" />)
    fireEvent.click(await screen.findByRole('button', { name: /queue/i }))
    const queued = await screen.findByRole('button', { name: /queued/i })
    expect((queued as HTMLButtonElement).disabled).toBe(true)
  })

  test('a failed queue write surfaces and leaves the row addable', async () => {
    onTickets.mockResolvedValue([ticket()])
    sendQueueTicket.mockResolvedValue({ ok: false, error: 'the queue could not be written' })
    render(<TicketsPanel projectId="p1" />)
    fireEvent.click(await screen.findByRole('button', { name: /queue/i }))
    expect(await screen.findByText(/could not be written/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /queued/i })).toBeNull()
  })

  test('an empty tickets/ offers the GitHub import instead of a dead end', async () => {
    onTickets.mockResolvedValue([])
    sendStart.mockResolvedValue({ ok: true, runId: 'r1' })
    render(<TicketsPanel projectId="p1" />)
    fireEvent.click(await screen.findByRole('button', { name: /import tickets from github/i }))
    await waitFor(() => expect(sendStart).toHaveBeenCalled())
    // A fixed prompt, so it takes the verbatim-text path rather than a build.
    expect(sendStart.mock.calls[0]?.[2]).toBe('prompt')
    expect(sendStart.mock.calls[0]?.[1]).toMatch(/GitHub issues into tickets\//i)
  })

  test('no project renders nothing at all', () => {
    const { container } = render(<TicketsPanel projectId={null} />)
    expect(container.textContent).toBe('')
    expect(onTickets).not.toHaveBeenCalled()
  })
})
