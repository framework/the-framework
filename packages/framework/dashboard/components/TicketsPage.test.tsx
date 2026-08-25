import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const onAllTickets = vi.hoisted(() => vi.fn())
// TicketsPanel (rendered per project here) reaches for these too; unmocked they fetch a daemon
// that is not there, same as TicketsPanel's own suite. `onQueue` is the spin-up button's
// click-time read of what is already queued.
const onTicketsMeta = vi.hoisted(() => vi.fn())
const onQueue = vi.hoisted(() => vi.fn())
vi.mock('../rpc/reads.js', () => ({ onAllTickets, onTicketsMeta, onQueue }))
vi.mock('../rpc/control.js', () => ({ sendQueueTicket: vi.fn(), sendQueueTicketPlan: vi.fn(), sendStart: vi.fn() }))

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
  onQueue.mockReset().mockResolvedValue([])
  // The page reads its view from the URL on mount and mirrors changes back via replaceState, so
  // every test starts from a clean address.
  window.history.replaceState(null, '', '/tickets')
})

/** Fresh control mocks for the tests that click the header's queue-adds. */
const controls = async () => {
  const { sendStart, sendQueueTicket, sendQueueTicketPlan } = await import('../rpc/control.js')
  vi.mocked(sendStart).mockClear().mockResolvedValue({ ok: true, agentId: 'a1' })
  vi.mocked(sendQueueTicket).mockClear().mockResolvedValue({ ok: true, file: 'TODO_AGENTS.md' })
  vi.mocked(sendQueueTicketPlan).mockClear().mockResolvedValue({ ok: true, file: 'TODO_AGENTS.md' })
  return { sendStart, sendQueueTicket, sendQueueTicketPlan }
}

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
  const fixture = (
    tickets = [
      ticket({ file: 'lock.md', title: 'Improve the lock', topics: ['dx'], priority: '9' }),
      ticket({ file: 'other.md', title: 'Something else', locked: true, lockedBy: 'agent-1' }),
    ],
  ) => onAllTickets.mockResolvedValue([{ projectId: 'p1', projectName: 'Alpha', tickets }])

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

  test('a badge whose topic is capitalised filters by it just the same', async () => {
    // Matching lowercases the ticket's topics, so an `UX` badge added verbatim matched nothing —
    // clicking it emptied the page instead of narrowing it.
    fixture([ticket({ file: 'ux.md', title: 'Polish the rail', topics: ['UX'] }), ticket({ file: 'other.md', title: 'Something else' })])
    render(<TicketsPage onOpenTicket={() => {}} />)
    await screen.findByText('Polish the rail')
    fireEvent.click(screen.getByRole('button', { name: 'UX' }))
    await waitFor(() => expect(screen.queryByText('Something else')).toBeNull())
    expect(screen.getByText('Polish the rail')).toBeTruthy()
    expect(window.location.search).toBe('?topics=ux')
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

// The page-wide queue-add button: the detail page's Queue action lifted to the page's heading —
// every unclaimed shown ticket joins the AI queue (unless an open entry already links to it),
// and no agent starts: the queue's own consumers do that.
describe('TicketsPage add the shown set to the AI queue', () => {
  test('every shown ticket joins the queue, and the button rests as Queued until the set changes', async () => {
    onAllTickets.mockResolvedValue([
      {
        projectId: 'p1',
        projectName: 'Alpha',
        tickets: [ticket({ file: 'a.md', title: 'First', priority: '7' }), ticket({ file: 'b.md', title: 'Second' })],
      },
    ])
    const { sendStart, sendQueueTicket } = await controls()
    render(<TicketsPage onOpenTicket={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Add all 2 tickets shown below to the AI queue' }))
    // Queued exactly as the detail page's Queue button queues (#1164): title as the entry, the
    // ticket named so the entry links back, its priority picking the section.
    await waitFor(() => expect(sendQueueTicket).toHaveBeenCalledTimes(2))
    expect(sendQueueTicket).toHaveBeenCalledWith('p1', 'First', { file: 'a.md', priority: '7' })
    expect(sendQueueTicket).toHaveBeenCalledWith('p1', 'Second', { file: 'b.md' })
    // Queueing is the whole act — the queue's own consumers start agents, not this button.
    expect(sendStart).not.toHaveBeenCalled()
    // Done, the button says so and rests for this exact set…
    const queued = await screen.findByRole('button', { name: 'Queued' })
    expect((queued as HTMLButtonElement).disabled).toBe(true)
    // …and narrowing the shown set arms it again, counting the new set.
    fireEvent.change(screen.getByRole('textbox', { name: /search tickets/i }), { target: { value: 'First' } })
    expect(await screen.findByRole('button', { name: 'Add the ticket shown below to the AI queue' })).toBeTruthy()
  })

  test('a ticket already on the queue is not queued twice', async () => {
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
    const { sendQueueTicket } = await controls()
    render(<TicketsPage onOpenTicket={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Add all 2 tickets shown below to the AI queue' }))
    // Only the genuinely unqueued ticket is written; a.md's open entry stands as it is.
    await screen.findByRole('button', { name: 'Queued' })
    expect(sendQueueTicket).toHaveBeenCalledTimes(1)
    expect(sendQueueTicket).toHaveBeenCalledWith('p1', 'Second', { file: 'b.md' })
  })

  test('claimed tickets are left to the agents holding them, and the label says so', async () => {
    onAllTickets.mockResolvedValue([
      {
        projectId: 'p1',
        projectName: 'Alpha',
        tickets: [ticket({ file: 'a.md', title: 'First' }), ticket({ file: 'b.md', title: 'Second', locked: true, lockedBy: 'agent-1' })],
      },
    ])
    const { sendQueueTicket } = await controls()
    render(<TicketsPage onOpenTicket={() => {}} />)
    // The label counts only what the click will add, never promising the claimed row.
    fireEvent.click(await screen.findByRole('button', { name: 'Add the one unclaimed ticket shown below to the AI queue' }))
    await screen.findByRole('button', { name: 'Queued' })
    expect(sendQueueTicket).toHaveBeenCalledTimes(1)
    expect(sendQueueTicket).toHaveBeenCalledWith('p1', 'First', { file: 'a.md' })
  })

  test('nothing shown, no buttons: an empty shown set is not an offer', async () => {
    onAllTickets.mockResolvedValue([
      { projectId: 'p1', projectName: 'Alpha', tickets: [ticket({ file: 'a.md', title: 'First' })] },
    ])
    window.history.replaceState(null, '', '/tickets?q=zzz-no-match')
    render(<TicketsPage onOpenTicket={() => {}} />)
    await screen.findByText(/1 ticket hidden by the current filters/i)
    expect(screen.queryByRole('button', { name: /to the ai queue/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /queue plans/i })).toBeNull()
  })

  test('every shown ticket claimed, no buttons: the whole set is already being worked', async () => {
    onAllTickets.mockResolvedValue([
      { projectId: 'p1', projectName: 'Alpha', tickets: [ticket({ file: 'a.md', title: 'First', locked: true })] },
    ])
    render(<TicketsPage onOpenTicket={() => {}} />)
    await screen.findByText('First')
    expect(screen.queryByRole('button', { name: /to the ai queue/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /queue a plan/i })).toBeNull()
  })
})

// The plan sibling of the queue-add: one `Create tickets/<stem>.plan.md` entry per shown ticket
// still to plan — the Plan tickets preset's own ask, placed by the ticket's priority — and no
// agent starts here either.
describe('TicketsPage queue plans for the shown set', () => {
  test('every shown ticket still to plan gets its plan queued, and the button rests as Plans queued', async () => {
    onAllTickets.mockResolvedValue([
      {
        projectId: 'p1',
        projectName: 'Alpha',
        tickets: [ticket({ file: 'a.md', title: 'First', priority: '7' }), ticket({ file: 'b.md', title: 'Second' })],
      },
    ])
    const { sendStart, sendQueueTicket, sendQueueTicketPlan } = await controls()
    render(<TicketsPage onOpenTicket={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Queue plans for all 2 tickets shown below' }))
    // One plan ask per ticket, the ticket named with its priority so the entry lands in its
    // section — and neither an implementation entry nor an agent comes out of this button.
    await waitFor(() => expect(sendQueueTicketPlan).toHaveBeenCalledTimes(2))
    expect(sendQueueTicketPlan).toHaveBeenCalledWith('p1', { file: 'a.md', priority: '7' })
    expect(sendQueueTicketPlan).toHaveBeenCalledWith('p1', { file: 'b.md' })
    expect(sendQueueTicket).not.toHaveBeenCalled()
    expect(sendStart).not.toHaveBeenCalled()
    const rested = await screen.findByRole('button', { name: 'Plans queued' })
    expect((rested as HTMLButtonElement).disabled).toBe(true)
  })

  test('planned and claimed tickets are skipped, and the label counts only what is left to plan', async () => {
    onAllTickets.mockResolvedValue([
      {
        projectId: 'p1',
        projectName: 'Alpha',
        tickets: [
          ticket({ file: 'a.md', title: 'First' }),
          ticket({ file: 'b.md', title: 'Second', planned: true }),
          ticket({ file: 'c.md', title: 'Third', locked: true, lockedBy: 'agent-1' }),
        ],
      },
    ])
    const { sendQueueTicketPlan } = await controls()
    render(<TicketsPage onOpenTicket={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Queue a plan for the one unplanned ticket shown below' }))
    await screen.findByRole('button', { name: 'Plans queued' })
    expect(sendQueueTicketPlan).toHaveBeenCalledTimes(1)
    expect(sendQueueTicketPlan).toHaveBeenCalledWith('p1', { file: 'a.md' })
  })

  test('a plan already asked for — or a ticket queued for implementation — is not asked again', async () => {
    onAllTickets.mockResolvedValue([
      {
        projectId: 'p1',
        projectName: 'Alpha',
        tickets: [
          ticket({ file: 'a.md', title: 'First' }),
          ticket({ file: 'b.md', title: 'Second' }),
          ticket({ file: 'c.md', title: 'Third' }),
        ],
      },
    ])
    // a.md's plan ask is already an open entry (recognized by its exact text); b.md is queued
    // for implementation, whose work would land before a trailing plan could matter.
    onQueue.mockResolvedValue([
      {
        projectId: 'p1',
        projectName: 'Alpha',
        open: 2,
        total: 2,
        items: [
          { text: 'Create tickets/a.plan.md', done: false },
          { text: '[Second](tickets/b.md)', done: false },
        ],
      },
    ])
    const { sendQueueTicketPlan } = await controls()
    render(<TicketsPage onOpenTicket={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Queue plans for all 3 tickets shown below' }))
    await screen.findByRole('button', { name: 'Plans queued' })
    expect(sendQueueTicketPlan).toHaveBeenCalledTimes(1)
    expect(sendQueueTicketPlan).toHaveBeenCalledWith('p1', { file: 'c.md' })
  })

  test('every shown ticket planned already, no plan button — the queue-add still offers', async () => {
    onAllTickets.mockResolvedValue([
      { projectId: 'p1', projectName: 'Alpha', tickets: [ticket({ file: 'a.md', title: 'First', planned: true })] },
    ])
    render(<TicketsPage onOpenTicket={() => {}} />)
    await screen.findByText('First')
    expect(screen.queryByRole('button', { name: /queue a plan|queue plans/i })).toBeNull()
    expect(screen.getByRole('button', { name: 'Add the ticket shown below to the AI queue' })).toBeTruthy()
  })
})

// Row selection (GitHub's list idiom): every row carries a checkbox, and while any is ticked the
// heading's queue buttons speak for — and act on — just the selected tickets.
describe('TicketsPage selection scopes the queue buttons', () => {
  const threeTickets = () =>
    onAllTickets.mockResolvedValue([
      {
        projectId: 'p1',
        projectName: 'Alpha',
        tickets: [
          ticket({ file: 'a.md', title: 'First', priority: '7' }),
          ticket({ file: 'b.md', title: 'Second' }),
          ticket({ file: 'c.md', title: 'Third' }),
        ],
      },
    ])

  test('selected tickets are what the queue-add adds — the rest of the shown set stays put', async () => {
    threeTickets()
    const { sendQueueTicket } = await controls()
    render(<TicketsPage onOpenTicket={() => {}} />)
    await screen.findByText('First')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select First' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Third' }))
    expect(screen.getByText('2 selected')).toBeTruthy()
    // The label stops speaking for the shown set and counts the selection instead.
    fireEvent.click(screen.getByRole('button', { name: 'Add the 2 selected tickets to the AI queue' }))
    await screen.findByRole('button', { name: 'Queued' })
    expect(sendQueueTicket).toHaveBeenCalledTimes(2)
    expect(sendQueueTicket).toHaveBeenCalledWith('p1', 'First', { file: 'a.md', priority: '7' })
    expect(sendQueueTicket).toHaveBeenCalledWith('p1', 'Third', { file: 'c.md' })
    // Changing the selection is changing the set: the rested button arms again for the new one.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Second' }))
    expect(await screen.findByRole('button', { name: 'Add the 3 selected tickets to the AI queue' })).toBeTruthy()
  })

  test('the plan button narrows to the selection the same way', async () => {
    threeTickets()
    const { sendQueueTicketPlan } = await controls()
    render(<TicketsPage onOpenTicket={() => {}} />)
    await screen.findByText('First')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Second' }))
    fireEvent.click(screen.getByRole('button', { name: 'Queue a plan for the selected ticket' }))
    await screen.findByRole('button', { name: 'Plans queued' })
    expect(sendQueueTicketPlan).toHaveBeenCalledTimes(1)
    expect(sendQueueTicketPlan).toHaveBeenCalledWith('p1', { file: 'b.md' })
  })

  test('clearing the selection hands the buttons back to the whole shown set', async () => {
    threeTickets()
    render(<TicketsPage onOpenTicket={() => {}} />)
    await screen.findByText('First')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select First' }))
    expect(screen.getByRole('button', { name: 'Add the selected ticket to the AI queue' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }))
    expect(screen.queryByText(/selected/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Add all 3 tickets shown below to the AI queue' })).toBeTruthy()
  })

  test('a claimed ticket in the selection is still skipped, and the label counts without it', async () => {
    onAllTickets.mockResolvedValue([
      {
        projectId: 'p1',
        projectName: 'Alpha',
        tickets: [
          ticket({ file: 'a.md', title: 'First' }),
          ticket({ file: 'b.md', title: 'Second', locked: true, lockedBy: 'agent-1' }),
        ],
      },
    ])
    const { sendQueueTicket } = await controls()
    render(<TicketsPage onOpenTicket={() => {}} />)
    await screen.findByText('First')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select First' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Second' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add the one unclaimed selected ticket to the AI queue' }))
    await screen.findByRole('button', { name: 'Queued' })
    expect(sendQueueTicket).toHaveBeenCalledTimes(1)
    expect(sendQueueTicket).toHaveBeenCalledWith('p1', 'First', { file: 'a.md' })
  })

  test('a selected ticket the filters hide is neither counted nor acted on, and stays selected', async () => {
    threeTickets()
    const { sendQueueTicket } = await controls()
    render(<TicketsPage onOpenTicket={() => {}} />)
    await screen.findByText('Second')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Second' }))
    // Hide the selected row: the selection has nothing shown, so the buttons speak for the
    // shown set again and the selection readout goes quiet.
    fireEvent.change(screen.getByRole('textbox', { name: /search tickets/i }), { target: { value: 'First' } })
    await waitFor(() => expect(screen.queryByText('Second')).toBeNull())
    expect(screen.queryByText('1 selected')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Add the ticket shown below to the AI queue' }))
    await screen.findByRole('button', { name: 'Queued' })
    expect(sendQueueTicket).toHaveBeenCalledTimes(1)
    expect(sendQueueTicket).toHaveBeenCalledWith('p1', 'First', { file: 'a.md', priority: '7' })
    // The tick itself survives the filter and comes back with the row.
    fireEvent.change(screen.getByRole('textbox', { name: /search tickets/i }), { target: { value: '' } })
    const box = await screen.findByRole('checkbox', { name: 'Select Second' })
    expect(box.getAttribute('data-checked')).not.toBeNull()
  })

  test('the flat cross-project list selects the same way, each row on its own project', async () => {
    onAllTickets.mockResolvedValue([
      { projectId: 'p1', projectName: 'Alpha', tickets: [ticket({ file: 'a.md', title: 'Alpha ticket' })] },
      { projectId: 'p2', projectName: 'Beta', tickets: [ticket({ file: 'b.md', title: 'Beta ticket' })] },
    ])
    window.history.replaceState(null, '', '/tickets?group=none')
    const { sendQueueTicket } = await controls()
    render(<TicketsPage onOpenTicket={() => {}} />)
    await screen.findByText('Beta ticket')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Beta ticket' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add the selected ticket to the AI queue' }))
    await screen.findByRole('button', { name: 'Queued' })
    expect(sendQueueTicket).toHaveBeenCalledTimes(1)
    expect(sendQueueTicket).toHaveBeenCalledWith('p2', 'Beta ticket', { file: 'b.md' })
  })
})
