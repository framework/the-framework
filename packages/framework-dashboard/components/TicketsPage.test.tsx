import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const onAllTickets = vi.hoisted(() => vi.fn())
// TicketsPanel (rendered per project here) reaches for these too; unmocked they pull the real
// telefunc client into jsdom, same as TicketsPanel's own suite.
const onTicketsMeta = vi.hoisted(() => vi.fn())
vi.mock('../server/reads.telefunc.js', () => ({ onAllTickets, onTicketsMeta }))
vi.mock('../server/control.telefunc.js', () => ({ sendQueueTicket: vi.fn(), sendStart: vi.fn() }))

const { TicketsPage } = await import('./TicketsPage.js')

const ticket = (over: Record<string, unknown> = {}) => ({
  file: 't.md',
  title: 'Do the thing',
  summary: '',
  date: '2026-01-01T00:00:00.000Z',
  planned: false,
  ...over,
})

beforeEach(() => {
  onTicketsMeta.mockReset().mockResolvedValue({})
})

afterEach(cleanup)

// The Tickets view (#1144): every registered project's backlog, one section each — reading
// onAllTickets itself and handing each project's list to its own TicketsPanel, which already
// knows how to render a one-liner row.
describe('TicketsPage (#1144)', () => {
  test('reads every project\'s tickets and lists each under its own project heading', async () => {
    onAllTickets.mockResolvedValue([
      { projectId: 'p1', projectName: 'Alpha', tickets: [ticket({ title: 'Do the thing' })] },
      { projectId: 'p2', projectName: 'Beta', tickets: [ticket({ file: 'b.md', title: 'Do the other thing' })] },
    ])
    render(<TicketsPage onOpenTicket={() => {}} />)
    expect(await screen.findByText('Alpha')).toBeTruthy()
    expect(screen.getByText('Beta')).toBeTruthy()
    expect(screen.getByText('Do the thing')).toBeTruthy()
    expect(screen.getByText('Do the other thing')).toBeTruthy()
  })

  test('opening a row hands back its project and file, for the detail route (#1144)', async () => {
    onAllTickets.mockResolvedValue([{ projectId: 'p1', projectName: 'Alpha', tickets: [ticket()] }])
    const onOpenTicket = vi.fn()
    render(<TicketsPage onOpenTicket={onOpenTicket} />)
    fireEvent.click(await screen.findByText('Do the thing'))
    expect(onOpenTicket).toHaveBeenCalledWith('p1', 't.md')
  })

  test('a project with no tickets still offers its own GitHub import, not a dead end', async () => {
    onAllTickets.mockResolvedValue([{ projectId: 'p1', projectName: 'Alpha', tickets: [] }])
    render(<TicketsPage onOpenTicket={() => {}} />)
    expect(await screen.findByText('Alpha')).toBeTruthy()
    expect(screen.getByRole('button', { name: /import tickets from github/i })).toBeTruthy()
  })

  test('no registered projects says so rather than an empty page', async () => {
    onAllTickets.mockResolvedValue([])
    render(<TicketsPage onOpenTicket={() => {}} />)
    expect(await screen.findByText(/no projects registered/i)).toBeTruthy()
  })

  test('an import/update session started in one project\'s section reports that project (#948)', async () => {
    onAllTickets.mockResolvedValue([{ projectId: 'p1', projectName: 'Alpha', tickets: [] }])
    const { sendStart } = await import('../server/control.telefunc.js')
    vi.mocked(sendStart).mockResolvedValue({ ok: true, runId: 'r1' })
    const onRunStarted = vi.fn()
    render(<TicketsPage onOpenTicket={() => {}} onRunStarted={onRunStarted} />)
    fireEvent.click(await screen.findByRole('button', { name: /import tickets from github/i }))
    await waitFor(() => expect(onRunStarted).toHaveBeenCalledWith('p1', expect.any(String), 'r1'))
  })
})

// The sort dropdown (#1144/#1265): the server already hands back newest-first, so "Date" is a
// no-op; "Priority" re-sorts client-side, ties falling back to that same newest-first order.
describe('TicketsPage sort (#1144/#1265)', () => {
  test('defaults to the server\'s date order', async () => {
    onAllTickets.mockResolvedValue([
      {
        projectId: 'p1',
        projectName: 'Alpha',
        tickets: [
          ticket({ file: 'low.md', title: 'Low priority', priority: '2' }),
          ticket({ file: 'high.md', title: 'High priority', priority: '9' }),
        ],
      },
    ])
    render(<TicketsPage onOpenTicket={() => {}} />)
    const titles = (await screen.findAllByRole('button')).map(b => b.textContent)
    // 'low.md' is first in the fixture, standing in for "whatever order the server sent" — the
    // default sort must not have reordered it.
    expect(titles.findIndex(t => t?.includes('Low priority'))).toBeLessThan(titles.findIndex(t => t?.includes('High priority')))
  })

  test('sorting by priority puts the highest first, regardless of the server\'s order', async () => {
    onAllTickets.mockResolvedValue([
      {
        projectId: 'p1',
        projectName: 'Alpha',
        tickets: [
          ticket({ file: 'low.md', title: 'Low priority', priority: '2' }),
          ticket({ file: 'high.md', title: 'High priority', priority: '9' }),
        ],
      },
    ])
    render(<TicketsPage onOpenTicket={() => {}} />)
    await screen.findByText('Low priority')
    fireEvent.change(screen.getByRole('combobox', { name: /sort by/i }), { target: { value: 'priority' } })
    const titles = (await screen.findAllByRole('button')).map(b => b.textContent)
    expect(titles.findIndex(t => t?.includes('High priority'))).toBeLessThan(titles.findIndex(t => t?.includes('Low priority')))
  })

  test('a priority tie falls back to newest first, not an arbitrary order', async () => {
    onAllTickets.mockResolvedValue([
      {
        projectId: 'p1',
        projectName: 'Alpha',
        tickets: [
          // Server order is already newest-first; both name the same priority.
          ticket({ file: 'newer.md', title: 'Newer', priority: '5', date: '2026-02-01T00:00:00.000Z' }),
          ticket({ file: 'older.md', title: 'Older', priority: '5', date: '2026-01-01T00:00:00.000Z' }),
        ],
      },
    ])
    render(<TicketsPage onOpenTicket={() => {}} />)
    await screen.findByText('Newer')
    fireEvent.change(screen.getByRole('combobox', { name: /sort by/i }), { target: { value: 'priority' } })
    const titles = (await screen.findAllByRole('button')).map(b => b.textContent)
    expect(titles.findIndex(t => t?.includes('Newer'))).toBeLessThan(titles.findIndex(t => t?.includes('Older')))
  })
})
