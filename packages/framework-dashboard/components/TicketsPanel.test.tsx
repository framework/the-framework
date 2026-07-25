import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { WorkspaceTicket } from '@gemstack/the-framework'

const sendQueueTicket = vi.hoisted(() => vi.fn())
const sendStart = vi.hoisted(() => vi.fn())
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
  sendQueueTicket.mockReset()
  sendStart.mockReset()
})

describe('TicketsPanel (#697)', () => {
  test('lists the tickets with what has already been done to them', async () => {
    render(<TicketsPanel projectId="p1" tickets={[ticket({ priority: 'high', planned: true })]} loaded />)
    expect(await screen.findByText('Do the thing')).toBeTruthy()
    expect(screen.getByText('The thing is not done.')).toBeTruthy()
    expect(screen.getByText('high')).toBeTruthy()
    expect(screen.getByText('planned')).toBeTruthy()
  })

  test('queueing a ticket writes it to the queue, with the ticket it came from (#1164)', async () => {
    sendQueueTicket.mockResolvedValue({ ok: true, file: 'TODO_AGENTS.md' })
    render(<TicketsPanel projectId="p1" tickets={[ticket({ priority: 'high' })]} loaded />)
    fireEvent.click(await screen.findByRole('button', { name: /queue/i }))
    // The file is what the entry links back to; the priority is what ranks it in the queue.
    await waitFor(() =>
      expect(sendQueueTicket).toHaveBeenCalledWith('p1', 'Do the thing', {
        file: '2026-07-20_do-the-thing.md',
        priority: 'high',
      }),
    )
  })

  test('an unprioritised ticket is queued without inventing one for it (#1164)', async () => {
    // The ticket format says `priority:` is optional; what unmarked means is the server's call.
    sendQueueTicket.mockResolvedValue({ ok: true, file: 'TODO_AGENTS.md' })
    render(<TicketsPanel projectId="p1" tickets={[ticket()]} loaded />)
    fireEvent.click(await screen.findByRole('button', { name: /queue/i }))
    await waitFor(() =>
      expect(sendQueueTicket).toHaveBeenCalledWith('p1', 'Do the thing', { file: '2026-07-20_do-the-thing.md' }),
    )
  })

  // The queue is a file, so a re-poll cannot tell us the row was queued: without remembering
  // the click the button would invite the same entry to be added twice.
  test('a queued ticket says so and cannot be queued twice', async () => {
    sendQueueTicket.mockResolvedValue({ ok: true, file: 'TODO_AGENTS.md' })
    render(<TicketsPanel projectId="p1" tickets={[ticket()]} loaded />)
    fireEvent.click(await screen.findByRole('button', { name: /queue/i }))
    const queued = await screen.findByRole('button', { name: /queued/i })
    expect((queued as HTMLButtonElement).disabled).toBe(true)
  })

  test('a failed queue write surfaces and leaves the row addable', async () => {
    sendQueueTicket.mockResolvedValue({ ok: false, error: 'the queue could not be written' })
    render(<TicketsPanel projectId="p1" tickets={[ticket()]} loaded />)
    fireEvent.click(await screen.findByRole('button', { name: /queue/i }))
    expect(await screen.findByText(/could not be written/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /queued/i })).toBeNull()
  })

  test('an empty tickets/ offers the GitHub import instead of a dead end', async () => {
    sendStart.mockResolvedValue({ ok: true, runId: 'r1' })
    render(<TicketsPanel projectId="p1" tickets={[]} loaded />)
    fireEvent.click(await screen.findByRole('button', { name: /import tickets from github/i }))
    await waitFor(() => expect(sendStart).toHaveBeenCalled())
    // A fixed prompt, so it takes the verbatim-text path rather than a build.
    expect(sendStart.mock.calls[0]?.[2]).toBe('prompt')
    expect(sendStart.mock.calls[0]?.[1]).toMatch(/GitHub issues into tickets\//i)
  })

  test('no project renders nothing at all', () => {
    const { container } = render(<TicketsPanel projectId={null} tickets={[]} loaded />)
    expect(container.textContent).toBe('')
  })
})
