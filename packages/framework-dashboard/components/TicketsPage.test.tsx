import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

const onTickets = vi.hoisted(() => vi.fn())
// TicketsPanel (rendered here) reaches for these too; unmocked they pull the real telefunc client
// into jsdom, same as TicketsPanel's own suite.
const onTicketsMeta = vi.hoisted(() => vi.fn())
vi.mock('../server/reads.telefunc.js', () => ({ onTickets, onTicketsMeta }))
vi.mock('../server/control.telefunc.js', () => ({ sendQueueTicket: vi.fn(), sendStart: vi.fn() }))

const { TicketsPage } = await import('./TicketsPage.js')

beforeEach(() => {
  onTicketsMeta.mockReset().mockResolvedValue({})
})

afterEach(cleanup)

// The tickets list page (#1144): what used to be a rail tab, now reading the project's tickets
// itself and handing the list to TicketsPanel as one-liners, which already knows how to render one.
describe('TicketsPage (#1144)', () => {
  test('reads the project\'s tickets and lists them', async () => {
    onTickets.mockResolvedValue([{ file: 't.md', title: 'Do the thing', summary: '', spiked: false, planned: false }])
    render(<TicketsPage projectId="p1" onOpenTicket={() => {}} />)
    expect(await screen.findByText('Do the thing')).toBeTruthy()
    expect(onTickets).toHaveBeenCalledWith('p1')
  })

  test('opening a row hands back its file, for the detail route (#1144)', async () => {
    onTickets.mockResolvedValue([{ file: 't.md', title: 'Do the thing', summary: '', spiked: false, planned: false }])
    const onOpenTicket = vi.fn()
    render(<TicketsPage projectId="p1" onOpenTicket={onOpenTicket} />)
    fireEvent.click(await screen.findByText('Do the thing'))
    expect(onOpenTicket).toHaveBeenCalledWith('t.md')
  })

  test('an empty backlog still offers the GitHub import, not a dead end', async () => {
    onTickets.mockResolvedValue([])
    render(<TicketsPage projectId="p1" onOpenTicket={() => {}} />)
    expect(await screen.findByRole('button', { name: /import tickets from github/i })).toBeTruthy()
  })
})
