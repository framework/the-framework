import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const onAllTickets = vi.hoisted(() => vi.fn())
// TicketsPanel (rendered per project here) reaches for these too; unmocked they fetch a daemon
// that is not there, same as TicketsPanel's own suite. `onQueue` is the spin-up button's
// click-time read of what is already queued.
const onTicketsMeta = vi.hoisted(() => vi.fn())
const onQueue = vi.hoisted(() => vi.fn())
vi.mock('../rpc/reads.js', () => ({ onAllTickets, onTicketsMeta, onQueue }))
vi.mock('../rpc/control.js', () => ({ sendQueueTicket: vi.fn(), sendStart: vi.fn() }))

const { TicketsPage } = await import('./TicketsPage.js')
const { workOnEntryPrompt } = await import('./AiQueue.js')

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
  onQueue.mockReset().mockResolvedValue([])
  // The page reads its view from the URL on mount and mirrors changes back via replaceState, so
  // every test starts from a clean address.
  window.history.replaceState(null, '', '/tickets')
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

  test('a project with no tickets still offers its own GitHub update, not a dead end', async () => {
    onAllTickets.mockResolvedValue([{ projectId: 'p1', projectName: 'Alpha', tickets: [] }])
    render(<TicketsPage onOpenTicket={() => {}} />)
    expect(await screen.findByText('Alpha')).toBeTruthy()
    expect(screen.getByRole('button', { name: /update from github/i })).toBeTruthy()
  })

  test('no registered projects says so rather than an empty page', async () => {
    onAllTickets.mockResolvedValue([])
    render(<TicketsPage onOpenTicket={() => {}} />)
    expect(await screen.findByText(/no projects registered/i)).toBeTruthy()
  })

  test('an import/update session started in one project\'s section reports that project (#948)', async () => {
    onAllTickets.mockResolvedValue([{ projectId: 'p1', projectName: 'Alpha', tickets: [] }])
    const { sendStart } = await import('../rpc/control.js')
    vi.mocked(sendStart).mockResolvedValue({ ok: true, agentId: 'r1' })
    const onAgentStarted = vi.fn()
    render(<TicketsPage onOpenTicket={() => {}} onAgentStarted={onAgentStarted} />)
    fireEvent.click(await screen.findByRole('button', { name: /update from github/i }))
    await waitFor(() => expect(onAgentStarted).toHaveBeenCalledWith('p1', expect.any(String), 'r1'))
  })
})

// The sort menu (#1144/#1265): the server already hands back newest-first, so the default Date ↓
// keeps its order; "Priority" re-sorts client-side, ties falling back to newest-first.
describe('TicketsPage sort (#1144/#1265)', () => {
  const twoByPriority = () =>
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

  test('defaults to the server\'s date order', async () => {
    twoByPriority()
    render(<TicketsPage onOpenTicket={() => {}} />)
    await screen.findByText('Low priority')
    const titles = screen.getAllByRole('button').map(b => b.textContent)
    // 'low.md' is first in the fixture, standing in for "whatever order the server sent" — the
    // default sort must not have reordered it.
    expect(titles.findIndex(t => t?.includes('Low priority'))).toBeLessThan(titles.findIndex(t => t?.includes('High priority')))
  })

  test('sorting by priority puts the highest first, and lands in the URL', async () => {
    twoByPriority()
    render(<TicketsPage onOpenTicket={() => {}} />)
    await screen.findByText('Low priority')
    fireEvent.click(screen.getByRole('button', { name: /sort: date/i }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Priority' }))
    const titles = (await screen.findAllByRole('button')).map(b => b.textContent)
    expect(titles.findIndex(t => t?.includes('High priority'))).toBeLessThan(titles.findIndex(t => t?.includes('Low priority')))
    expect(window.location.search).toBe('?sort=priority')
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
    fireEvent.click(screen.getByRole('button', { name: /sort: date/i }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Priority' }))
    const titles = (await screen.findAllByRole('button')).map(b => b.textContent)
    expect(titles.findIndex(t => t?.includes('Newer'))).toBeLessThan(titles.findIndex(t => t?.includes('Older')))
  })
})

// The filters (#1144): search + facets, state mirrored to the URL so a filtered view is a link.
describe('TicketsPage filters (#1144)', () => {
  const fixture = () =>
    onAllTickets.mockResolvedValue([
      {
        projectId: 'p1',
        projectName: 'Alpha',
        tickets: [
          ticket({ file: 'lock.md', title: 'Improve the lock', topics: ['dx'], priority: '9' }),
          ticket({ file: 'other.md', title: 'Something else', locked: true, lockedBy: 'agent-1' }),
        ],
      },
    ])

  test('searching narrows the rows and writes q= to the URL', async () => {
    fixture()
    render(<TicketsPage onOpenTicket={() => {}} />)
    await screen.findByText('Improve the lock')
    // The shown/total tally sits beside the page title, full pool while unfiltered.
    expect(screen.getByText('2/2')).toBeTruthy()
    fireEvent.change(screen.getByRole('textbox', { name: /search tickets/i }), { target: { value: 'lock' } })
    await waitFor(() => expect(screen.queryByText('Something else')).toBeNull())
    expect(screen.getByText('Improve the lock')).toBeTruthy()
    expect(screen.getByText('1/2')).toBeTruthy()
    expect(window.location.search).toBe('?q=lock')
  })

  test('the URL is the initial state: mounting under ?q= starts filtered', async () => {
    fixture()
    window.history.replaceState(null, '', '/tickets?q=lock')
    render(<TicketsPage onOpenTicket={() => {}} />)
    expect(await screen.findByText('Improve the lock')).toBeTruthy()
    expect(screen.queryByText('Something else')).toBeNull()
  })

  test('clicking a row\'s topic badge adds that topic filter (#1144)', async () => {
    fixture()
    render(<TicketsPage onOpenTicket={() => {}} />)
    await screen.findByText('Improve the lock')
    fireEvent.click(screen.getByRole('button', { name: 'dx' }))
    await waitFor(() => expect(screen.queryByText('Something else')).toBeNull())
    expect(window.location.search).toBe('?topics=dx')
  })

  test('clicking the claim marker narrows to claimed tickets', async () => {
    fixture()
    render(<TicketsPage onOpenTicket={() => {}} />)
    await screen.findByText('Something else')
    fireEvent.click(screen.getByText('agent-1'))
    await waitFor(() => expect(screen.queryByText('Improve the lock')).toBeNull())
    expect(screen.getByText('Something else')).toBeTruthy()
    expect(window.location.search).toBe('?stage=claimed')
  })

  test('a project filtered to nothing says so and clears from right there', async () => {
    fixture()
    window.history.replaceState(null, '', '/tickets?q=zzz-no-match')
    render(<TicketsPage onOpenTicket={() => {}} />)
    expect(await screen.findByText(/2 tickets hidden by the current filters/i)).toBeTruthy()
    // Not the update offer — these tickets exist, they are filtered (#1230's rule, kept).
    expect(screen.queryByRole('button', { name: /update from github/i })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /clear filters/i }))
    expect(await screen.findByText('Improve the lock')).toBeTruthy()
    expect(window.location.search).toBe('')
  })
})

// Group by (#1144): project sections by default; a flat cross-project list on demand — the one
// view that can answer "what is the single highest-priority ticket anywhere".
describe('TicketsPage grouping (#1144)', () => {
  test('group=none renders one flat list, rows tagged with their project, sorted across projects', async () => {
    onAllTickets.mockResolvedValue([
      { projectId: 'p1', projectName: 'Alpha', tickets: [ticket({ file: 'a.md', title: 'Alpha ticket', priority: '2' })] },
      { projectId: 'p2', projectName: 'Beta', tickets: [ticket({ file: 'b.md', title: 'Beta ticket', priority: '9' })] },
    ])
    window.history.replaceState(null, '', '/tickets?sort=priority&group=none')
    render(<TicketsPage onOpenTicket={() => {}} />)
    await screen.findByText('Beta ticket')
    // Project names ride the rows now — there are no section headings to say them.
    expect(screen.getByText('Alpha')).toBeTruthy()
    expect(screen.getByText('Beta')).toBeTruthy()
    // Cross-project priority order: Beta's 9 above Alpha's 2.
    const titles = (await screen.findAllByRole('button')).map(b => b.textContent)
    expect(titles.findIndex(t => t?.includes('Beta ticket'))).toBeLessThan(titles.findIndex(t => t?.includes('Alpha ticket')))
    // No per-project Update bars in the flat list.
    expect(screen.queryByRole('button', { name: /update from github/i })).toBeNull()
  })

  test('opening a flat row still hands back its own project and file', async () => {
    onAllTickets.mockResolvedValue([
      { projectId: 'p2', projectName: 'Beta', tickets: [ticket({ file: 'b.md', title: 'Beta ticket' })] },
    ])
    window.history.replaceState(null, '', '/tickets?group=none')
    const onOpenTicket = vi.fn()
    render(<TicketsPage onOpenTicket={onOpenTicket} />)
    fireEvent.click(await screen.findByText('Beta ticket'))
    expect(onOpenTicket).toHaveBeenCalledWith('p2', 'b.md')
  })

  test("a flat row's start button spins up an agent in that row's own project (#1117)", async () => {
    onAllTickets.mockResolvedValue([
      { projectId: 'p2', projectName: 'Beta', tickets: [ticket({ file: 'b.md', title: 'Beta ticket' })] },
    ])
    window.history.replaceState(null, '', '/tickets?group=none')
    const { sendStart } = await import('../rpc/control.js')
    vi.mocked(sendStart).mockResolvedValue({ ok: true, agentId: 'r9' })
    const onAgentStarted = vi.fn()
    render(<TicketsPage onOpenTicket={() => {}} onAgentStarted={onAgentStarted} />)
    fireEvent.click(await screen.findByRole('button', { name: /start work on beta ticket/i }))
    // The row's own project, not a panel-bound one — the flat list carries one per row.
    await waitFor(() =>
      expect(sendStart).toHaveBeenCalledWith('p2', expect.stringContaining('tickets/b.md'), 'prompt', {
        unattended: true,
        ticket: 'tickets/b.md',
      }),
    )
    await waitFor(() => expect(onAgentStarted).toHaveBeenCalledWith('p2', expect.any(String), 'r9'))
  })
})

// The page-wide spin-up button: the row's play button lifted to the page's heading — one agent
// per shown ticket, via the AI queue. Each unclaimed shown ticket is queued (unless an open
// entry already links to it) and gets its own unattended agent working that one entry.
describe('TicketsPage spin up the shown set', () => {
  const controls = async () => {
    const { sendStart, sendQueueTicket } = await import('../rpc/control.js')
    vi.mocked(sendStart).mockClear().mockResolvedValue({ ok: true, agentId: 'a1' })
    vi.mocked(sendQueueTicket).mockClear().mockResolvedValue({ ok: true, file: 'TODO_AGENTS.md' })
    return { sendStart, sendQueueTicket }
  }

  test('one agent per shown ticket: each is queued and started on its own entry', async () => {
    onAllTickets.mockResolvedValue([
      {
        projectId: 'p1',
        projectName: 'Alpha',
        tickets: [ticket({ file: 'a.md', title: 'First', priority: '7' }), ticket({ file: 'b.md', title: 'Second' })],
      },
    ])
    const { sendStart, sendQueueTicket } = await controls()
    const onAgentStarted = vi.fn()
    render(<TicketsPage onOpenTicket={() => {}} onAgentStarted={onAgentStarted} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Spin up agents working on all 2 tickets shown below' }))
    // Queued exactly as the detail page's Queue button queues (#1164): title as the entry, the
    // ticket named so the entry links back, its priority picking the section.
    await waitFor(() => expect(sendQueueTicket).toHaveBeenCalledTimes(2))
    expect(sendQueueTicket).toHaveBeenCalledWith('p1', 'First', { file: 'a.md', priority: '7' })
    expect(sendQueueTicket).toHaveBeenCalledWith('p1', 'Second', { file: 'b.md' })
    // Started exactly as the queue card's play button starts (#855): the per-entry ask on the
    // very line the queue write produced, unattended, the ticket named on the agent (#1117).
    const firstPrompt = workOnEntryPrompt('[First](tickets/a.md)')
    await waitFor(() => expect(sendStart).toHaveBeenCalledTimes(2))
    expect(sendStart).toHaveBeenCalledWith('p1', firstPrompt, 'prompt', { unattended: true, ticket: 'tickets/a.md' })
    expect(sendStart).toHaveBeenCalledWith('p1', workOnEntryPrompt('[Second](tickets/b.md)'), 'prompt', {
      unattended: true,
      ticket: 'tickets/b.md',
    })
    // The shell is pointed at one agent, not bounced through all of them.
    await waitFor(() => expect(onAgentStarted).toHaveBeenCalledTimes(1))
    expect(onAgentStarted).toHaveBeenCalledWith('p1', firstPrompt, 'a1')
  })

  test('a ticket already on the queue is not queued twice — its open entry is worked as it stands', async () => {
    onAllTickets.mockResolvedValue([
      {
        projectId: 'p1',
        projectName: 'Alpha',
        tickets: [ticket({ file: 'a.md', title: 'First' }), ticket({ file: 'b.md', title: 'Second' })],
      },
    ])
    // One open entry already links to a.md (with an agent's own note after the link); b.md's
    // only entry is checked off, so it does not count as queued.
    onQueue.mockResolvedValue([
      {
        projectId: 'p1',
        projectName: 'Alpha',
        open: 1,
        total: 2,
        items: [
          { text: '[First](tickets/a.md) — needs the new API', done: false },
          { text: '[Second](tickets/b.md)', done: true },
        ],
      },
    ])
    const { sendStart, sendQueueTicket } = await controls()
    render(<TicketsPage onOpenTicket={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Spin up agents working on all 2 tickets shown below' }))
    await waitFor(() => expect(sendStart).toHaveBeenCalledTimes(2))
    // Only the genuinely unqueued ticket is written; the queued one's agent is pointed at the
    // existing line verbatim, note and all — that is the line it must find to check off.
    expect(sendQueueTicket).toHaveBeenCalledTimes(1)
    expect(sendQueueTicket).toHaveBeenCalledWith('p1', 'Second', { file: 'b.md' })
    expect(sendStart).toHaveBeenCalledWith('p1', workOnEntryPrompt('[First](tickets/a.md) — needs the new API'), 'prompt', {
      unattended: true,
      ticket: 'tickets/a.md',
    })
  })

  test('claimed tickets are left to the agents holding them, and the label says so', async () => {
    onAllTickets.mockResolvedValue([
      {
        projectId: 'p1',
        projectName: 'Alpha',
        tickets: [ticket({ file: 'a.md', title: 'First' }), ticket({ file: 'b.md', title: 'Second', locked: true, lockedBy: 'agent-1' })],
      },
    ])
    const { sendStart, sendQueueTicket } = await controls()
    render(<TicketsPage onOpenTicket={() => {}} />)
    // The label counts only what the click will start, never promising the claimed row.
    fireEvent.click(await screen.findByRole('button', { name: 'Spin up an agent working on the one unclaimed ticket shown below' }))
    await waitFor(() => expect(sendStart).toHaveBeenCalledTimes(1))
    expect(sendQueueTicket).toHaveBeenCalledTimes(1)
    expect(sendQueueTicket).toHaveBeenCalledWith('p1', 'First', { file: 'a.md' })
    expect(sendStart).toHaveBeenCalledWith('p1', workOnEntryPrompt('[First](tickets/a.md)'), 'prompt', {
      unattended: true,
      ticket: 'tickets/a.md',
    })
  })

  test('nothing shown, no button: an empty shown set is not an offer', async () => {
    onAllTickets.mockResolvedValue([
      { projectId: 'p1', projectName: 'Alpha', tickets: [ticket({ file: 'a.md', title: 'First' })] },
    ])
    window.history.replaceState(null, '', '/tickets?q=zzz-no-match')
    render(<TicketsPage onOpenTicket={() => {}} />)
    await screen.findByText(/1 ticket hidden by the current filters/i)
    expect(screen.queryByRole('button', { name: /spin up/i })).toBeNull()
  })

  test('every shown ticket claimed, no button: the whole set is already being worked', async () => {
    onAllTickets.mockResolvedValue([
      { projectId: 'p1', projectName: 'Alpha', tickets: [ticket({ file: 'a.md', title: 'First', locked: true })] },
    ])
    render(<TicketsPage onOpenTicket={() => {}} />)
    await screen.findByText('First')
    expect(screen.queryByRole('button', { name: /spin up/i })).toBeNull()
  })
})
