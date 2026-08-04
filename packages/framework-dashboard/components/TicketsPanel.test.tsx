import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { WorkspaceTicket } from '@gemstack/the-framework'
import { presets } from '@gemstack/the-framework/client'

const sendStart = vi.hoisted(() => vi.fn())
vi.mock('../server/control.telefunc.js', () => ({ sendStart }))

// The last-import stamp (#1208). Mocked at the lib boundary like every other read here: an
// unmocked `*.telefunc.js` anywhere in the import graph fails the whole file as an
// assertIsNotBrowser "telefunc bug", which reads as anything but the missing mock it is.
const onTicketsMeta = vi.hoisted(() => vi.fn())
vi.mock('../server/reads.telefunc.js', () => ({ onTicketsMeta }))

const { TicketsPanel, planPrompt } = await import('./TicketsPanel.js')

const ticket = (over: Partial<WorkspaceTicket> = {}): WorkspaceTicket => ({
  file: '2026-07-20_do-the-thing.md',
  title: 'Do the thing',
  summary: 'The thing is not done.',
  date: '2026-01-01T00:00:00.000Z',
  planned: false,
  ...over,
})

beforeEach(() => {
  onTicketsMeta.mockReset().mockResolvedValue({})
})

afterEach(() => {
  cleanup()
  sendStart.mockReset()
})

describe('TicketsPanel (#697/#1144)', () => {
  test('lists the tickets as one-liners, with what has already been done to them', async () => {
    render(<TicketsPanel projectId="p1" tickets={[ticket({ priority: '8', locked: true, lockedBy: 'agent-1' })]} loaded onOpen={() => {}} />)
    expect(await screen.findByText('Do the thing')).toBeTruthy()
    // The claim marker (#1420): a hammer plus the holder, inline on the row.
    expect(screen.getByText('agent-1')).toBeTruthy()
    // The summary moved to the detail page (#1144); the list row is a one-liner.
    expect(screen.queryByText('The thing is not done.')).toBeNull()
  })

  test('the plan column links a planned ticket to its plan, by the same slug the plan route uses (#685)', async () => {
    const onOpenPlan = vi.fn()
    render(<TicketsPanel projectId="p1" tickets={[ticket({ planned: true })]} loaded onOpen={() => {}} onOpenPlan={onOpenPlan} />)
    // "planned" is no longer a badge — the column says it, and gives somewhere to go with it.
    expect(screen.queryByText('planned')).toBeNull()
    fireEvent.click(await screen.findByRole('button', { name: /view the plan for do the thing/i }))
    expect(onOpenPlan).toHaveBeenCalledWith('2026-07-20_do-the-thing.md')
  })

  test('the plan column starts a session to write the plan when the ticket has none (#685)', async () => {
    sendStart.mockResolvedValue({ ok: true, runId: 'r3' })
    const onRunStarted = vi.fn()
    render(<TicketsPanel projectId="p1" tickets={[ticket({ planned: false })]} loaded onOpen={() => {}} onRunStarted={onRunStarted} />)
    fireEvent.click(await screen.findByRole('button', { name: /create a plan for do the thing/i }))
    await waitFor(() => expect(sendStart).toHaveBeenCalled())
    // A fixed prompt, so it takes the verbatim-text path rather than a build, and it is exactly the
    // exported ask — no second, hidden copy to drift from the button (#1187).
    expect(sendStart.mock.calls[0]?.[2]).toBe('prompt')
    expect(sendStart.mock.calls[0]?.[1]).toBe(planPrompt('2026-07-20_do-the-thing.md'))
    expect(sendStart.mock.calls[0]?.[1]).toBe('Create tickets/2026-07-20_do-the-thing.plan.md')
    // Attended, unlike the import/update buttons: a per-ticket plan is a session you land in.
    expect(sendStart.mock.calls[0]?.[3]).toEqual({})
    await waitFor(() => expect(onRunStarted).toHaveBeenCalledWith(expect.any(String), 'r3'))
  })

  test('a claimed ticket shows the hammer marker with its holder inline (#1420/#1144)', async () => {
    render(<TicketsPanel projectId="p1" tickets={[ticket({ locked: true, lockedBy: 'spike-1-0' })]} loaded onOpen={() => {}} />)
    // Inline, not tooltip-only: a still 1-2s hover is how nobody discovers anything. The tooltip
    // adds what the icon cannot say — that the agent may be planning OR implementing.
    expect(await screen.findByText('spike-1-0')).toBeTruthy()
  })

  test('topic badges filter on click when the page passes a handler, without opening the row (#1144)', async () => {
    const onOpen = vi.fn()
    const onTopicClick = vi.fn()
    render(<TicketsPanel projectId="p1" tickets={[ticket({ topics: ['dx'] })]} loaded onOpen={onOpen} onTopicClick={onTopicClick} />)
    fireEvent.click(await screen.findByRole('button', { name: 'dx' }))
    expect(onTopicClick).toHaveBeenCalledWith('dx')
    // A sibling of the row's open button, like the plan cell: filtering must not also navigate.
    expect(onOpen).not.toHaveBeenCalled()
  })

  test('the claim marker filters to claimed tickets on click (#1144)', async () => {
    const onClaimedClick = vi.fn()
    render(
      <TicketsPanel
        projectId="p1"
        tickets={[ticket({ locked: true, lockedBy: 'agent-1' })]}
        loaded
        onOpen={() => {}}
        onClaimedClick={onClaimedClick}
      />,
    )
    fireEvent.click(await screen.findByText('agent-1'))
    expect(onClaimedClick).toHaveBeenCalled()
  })

  test('shows meta on the row: priority spelled out, topics, and a human-readable date (#1144/#1265)', async () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60_000).toISOString()
    render(
      <TicketsPanel
        projectId="p1"
        tickets={[ticket({ priority: '8', topics: ['dx', 'ui'], date: twoDaysAgo })]}
        loaded
        onOpen={() => {}}
      />,
    )
    // A bare "8" would be cryptic on its own; the row spells out what it is a rating of.
    expect(await screen.findByText('Priority: 8')).toBeTruthy()
    expect(screen.getByText('dx')).toBeTruthy()
    expect(screen.getByText('ui')).toBeTruthy()
    expect(screen.getByText('2d ago')).toBeTruthy()
  })

  test('sorts by date is the server\'s job — the list renders whatever order it is given (#1144)', async () => {
    // readTickets already sorts newest-first; the panel is not re-sorting behind the caller's back.
    render(
      <TicketsPanel
        projectId="p1"
        tickets={[ticket({ file: 'older.md', title: 'Older' }), ticket({ file: 'newer.md', title: 'Newer' })]}
        loaded
        onOpen={() => {}}
      />,
    )
    const titles = (await screen.findAllByRole('button')).map(b => b.textContent)
    expect(titles.findIndex(t => t?.includes('Older'))).toBeLessThan(titles.findIndex(t => t?.includes('Newer')))
  })

  test('links the row\'s GitHub issue out, without hijacking the row\'s own click (#1144/#1265)', async () => {
    const onOpen = vi.fn()
    render(
      <TicketsPanel
        projectId="p1"
        tickets={[ticket({ github: { label: '#42', url: 'https://github.com/org/repo/issues/42' } })]}
        loaded
        onOpen={onOpen}
      />,
    )
    const link = await screen.findByRole('link', { name: /#42/ })
    expect(link.getAttribute('href')).toBe('https://github.com/org/repo/issues/42')
    // A sibling of the row's button, not a child: clicking the link must not open the detail page.
    fireEvent.click(link)
    expect(onOpen).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Do the thing'))
    expect(onOpen).toHaveBeenCalledWith('2026-07-20_do-the-thing.md')
  })

  test('shows the effort the plan recorded, and keeps the row meta in priority/date/GitHub order (#1144/#1265)', async () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60_000).toISOString()
    render(
      <TicketsPanel
        projectId="p1"
        tickets={[
          ticket({
            planned: true,
            effort: 2,
            uncertainty: 4,
            priority: '7',
            date: twoDaysAgo,
            github: { label: '#42', url: 'https://github.com/org/repo/issues/42' },
          }),
        ]}
        loaded
        onOpen={() => {}}
      />,
    )
    expect(await screen.findByText('Effort: 2')).toBeTruthy()
    expect(screen.getByText('Uncertainty: 4')).toBeTruthy()
    // Priority sits left of the date (#1265), the date left of the issue link.
    const row = screen.getByText('Do the thing').closest('li')!
    const order = [row.textContent!.indexOf('Priority'), row.textContent!.indexOf('ago'), row.textContent!.indexOf('#42')]
    expect(order.every(i => i !== -1)).toBe(true)
    expect(order[0]).toBeLessThan(order[1]!)
    expect(order[1]).toBeLessThan(order[2]!)
  })

  test('opening a row hands back its file, the slug the detail route uses (#1144)', async () => {
    const onOpen = vi.fn()
    render(<TicketsPanel projectId="p1" tickets={[ticket()]} loaded onOpen={onOpen} />)
    fireEvent.click(await screen.findByText('Do the thing'))
    expect(onOpen).toHaveBeenCalledWith('2026-07-20_do-the-thing.md')
  })

  test('an empty tickets/ offers the GitHub import instead of a dead end', async () => {
    sendStart.mockResolvedValue({ ok: true, runId: 'r1' })
    const onRunStarted = vi.fn()
    render(<TicketsPanel projectId="p1" tickets={[]} loaded onOpen={() => {}} onRunStarted={onRunStarted} />)
    fireEvent.click(await screen.findByRole('button', { name: /import tickets from github/i }))
    await waitFor(() => expect(sendStart).toHaveBeenCalled())
    // A fixed prompt, so it takes the verbatim-text path rather than a build.
    expect(sendStart.mock.calls[0]?.[2]).toBe('prompt')
    expect(sendStart.mock.calls[0]?.[1]).toMatch(/GitHub issues into tickets\//i)
    // And it is the preset's own text: the onboarding checklist offers this button under the same
    // label and sends `presets.importTickets`, so a second source here means one label, two asks.
    expect(sendStart.mock.calls[0]?.[1]).toBe(presets.importTickets.render())
    // Unattended (#1279): a button-fired import ends at settle instead of parking in the chat loop.
    expect(sendStart.mock.calls[0]?.[3]).toEqual({ unattended: true })
    // The run id is what lands you on the import session rather than the project home (#1169).
    await waitFor(() => expect(onRunStarted).toHaveBeenCalledWith(expect.any(String), 'r1'))
  })

  test('a refused import says why and moves you nowhere (#1169)', async () => {
    sendStart.mockResolvedValue({ ok: false, error: 'a session is already active' })
    const onRunStarted = vi.fn()
    render(<TicketsPanel projectId="p1" tickets={[]} loaded onOpen={() => {}} onRunStarted={onRunStarted} />)
    fireEvent.click(await screen.findByRole('button', { name: /import tickets from github/i }))
    expect(await screen.findByText(/already active/i)).toBeTruthy()
    expect(onRunStarted).not.toHaveBeenCalled()
  })

  test('a filled tickets/ offers the update, and sends the update preset verbatim (#1208)', async () => {
    sendStart.mockResolvedValue({ ok: true, runId: 'r2' })
    const onRunStarted = vi.fn()
    render(<TicketsPanel projectId="p1" tickets={[ticket()]} loaded onOpen={() => {}} onRunStarted={onRunStarted} />)
    fireEvent.click(await screen.findByRole('button', { name: /update from github/i }))
    await waitFor(() => expect(sendStart).toHaveBeenCalled())
    expect(sendStart.mock.calls[0]?.[2]).toBe('prompt')
    // Its own preset, not the import's: the two ask for different work on a full directory.
    expect(sendStart.mock.calls[0]?.[1]).toBe(presets.updateTickets.render())
    expect(sendStart.mock.calls[0]?.[1]).not.toBe(presets.importTickets.render())
    await waitFor(() => expect(onRunStarted).toHaveBeenCalledWith(expect.any(String), 'r2'))
  })

  test('the update is not offered on an empty tickets/, where importing is the word (#1208)', async () => {
    render(<TicketsPanel projectId="p1" tickets={[]} loaded onOpen={() => {}} />)
    expect(await screen.findByRole('button', { name: /import tickets from github/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /update from github/i })).toBeNull()
  })

  test('the stamp says when tickets/ last caught up, and admits when it does not know (#1208)', async () => {
    onTicketsMeta.mockResolvedValue({ lastImportedAt: new Date(Date.now() - 3 * 60 * 60_000).toISOString() })
    render(<TicketsPanel projectId="p1" tickets={[ticket()]} loaded onOpen={() => {}} />)
    expect(await screen.findByText('Updated from GitHub 3h ago')).toBeTruthy()
    cleanup()
    // A repo imported before the stamp existed has none, and saying so beats inventing a date.
    onTicketsMeta.mockResolvedValue({})
    render(<TicketsPanel projectId="p1" tickets={[ticket()]} loaded onOpen={() => {}} />)
    expect(await screen.findByText('No record of an import yet')).toBeTruthy()
  })

  test('a refused update says why and moves you nowhere (#1208)', async () => {
    sendStart.mockResolvedValue({ ok: false, error: 'a session is already active' })
    const onRunStarted = vi.fn()
    render(<TicketsPanel projectId="p1" tickets={[ticket()]} loaded onOpen={() => {}} onRunStarted={onRunStarted} />)
    fireEvent.click(await screen.findByRole('button', { name: /update from github/i }))
    expect(await screen.findByText(/already active/i)).toBeTruthy()
    expect(onRunStarted).not.toHaveBeenCalled()
  })

  test('an empty list with hiddenByFilter says so, rather than offering an import for work already done (#1144/#1230)', async () => {
    render(<TicketsPanel projectId="p1" tickets={[]} loaded hiddenByFilter={3} onOpen={() => {}} />)
    expect(await screen.findByText(/3 tickets hidden by the current filter/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /import tickets from github/i })).toBeNull()
  })

  test('no project renders nothing at all', () => {
    const { container } = render(<TicketsPanel projectId={null} tickets={[]} loaded onOpen={() => {}} />)
    expect(container.textContent).toBe('')
  })
})
