import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { WorkspaceTicket } from '@gemstack/the-framework'

// The section polls onTickets; TicketsPanel inside it reaches for the freshness read and the
// start/queue actions — stub them all so the real telefunc client never loads into jsdom.
const onTickets = vi.hoisted(() => vi.fn())
const onTicketsMeta = vi.hoisted(() => vi.fn())
vi.mock('../server/reads.telefunc.js', () => ({ onTickets, onTicketsMeta }))
vi.mock('../server/control.telefunc.js', () => ({ sendQueueTicket: vi.fn(), sendStart: vi.fn() }))

const { ProjectTickets } = await import('./ProjectTickets.js')

beforeEach(() => {
  onTickets.mockReset().mockResolvedValue([])
  onTicketsMeta.mockReset().mockResolvedValue({})
})

afterEach(cleanup)

const ticket = (file: string, status: 'open' | 'closed' = 'open'): WorkspaceTicket => ({
  file,
  title: file.replace('.md', ''),
  summary: '',
  status,
  date: '2026-07-01T00:00:00.000Z',
  spiked: false,
  planned: false,
})

const props = {
  projectId: 'p1',
  onOpenTicket: vi.fn(),
  onShowAllTickets: vi.fn(),
}

describe('ProjectTickets (#1455 item 5)', () => {
  test('a project with no tickets gets no section at all', async () => {
    const { container } = render(<ProjectTickets {...props} />)
    await waitFor(() => expect(onTickets).toHaveBeenCalledWith('p1'))
    expect(container.textContent).toBe('')
  })

  test('open tickets render in the /tickets presentation; closed ones only count', async () => {
    onTickets.mockResolvedValue([ticket('a.md'), ticket('b.md'), ticket('done.md', 'closed')])
    render(<ProjectTickets {...props} />)
    await waitFor(() => expect(screen.getByText('Tickets · 2 open')).toBeTruthy())
    expect(screen.getByText('a')).toBeTruthy()
    expect(screen.getByText('b')).toBeTruthy()
    expect(screen.queryByText('done')).toBeNull()
  })

  test('opening a ticket and jumping to the full page both wire through', async () => {
    onTickets.mockResolvedValue([ticket('a.md')])
    const onOpenTicket = vi.fn()
    const onShowAllTickets = vi.fn()
    render(<ProjectTickets {...props} onOpenTicket={onOpenTicket} onShowAllTickets={onShowAllTickets} />)
    await waitFor(() => expect(screen.getByText('a')).toBeTruthy())
    fireEvent.click(screen.getByText('a'))
    expect(onOpenTicket).toHaveBeenCalledWith('a.md')
    fireEvent.click(screen.getByText('All projects →'))
    expect(onShowAllTickets).toHaveBeenCalled()
  })

  test('a backlog of only closed tickets still shows the section, saying what is hidden', async () => {
    onTickets.mockResolvedValue([ticket('done.md', 'closed')])
    render(<ProjectTickets {...props} />)
    await waitFor(() => expect(screen.getByText('Tickets · 0 open')).toBeTruthy())
    // TicketsPanel's own empty-but-filtered line, so this reads as "filtered", not "no backlog".
    expect(screen.getByText(/1 ticket hidden by the current filter/)).toBeTruthy()
  })
})
