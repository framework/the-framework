import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

const onTickets = vi.hoisted(() => vi.fn())
vi.mock('../server/reads.telefunc.js', () => ({ onTickets }))
// TicketsPanel (rendered here) reaches for these too; unmocked they pull the real telefunc client
// into jsdom, same as TicketsPanel's own suite.
vi.mock('../server/control.telefunc.js', () => ({ sendQueueTicket: vi.fn(), sendStart: vi.fn() }))

const { TicketsPage } = await import('./TicketsPage.js')

afterEach(cleanup)

// The tickets page (#1144): what used to be a rail tab, now reading the project's tickets itself
// and handing the list to TicketsPanel, which already knows how to render a ticket.
describe('TicketsPage (#1144)', () => {
  test('reads the project\'s tickets and lists them', async () => {
    onTickets.mockResolvedValue([{ file: 't.md', title: 'Do the thing', summary: '', spiked: false, planned: false }])
    render(<TicketsPage projectId="p1" />)
    expect(await screen.findByText('Do the thing')).toBeTruthy()
    expect(onTickets).toHaveBeenCalledWith('p1')
  })

  test('an empty backlog still offers the GitHub import, not a dead end', async () => {
    onTickets.mockResolvedValue([])
    render(<TicketsPage projectId="p1" />)
    expect(await screen.findByRole('button', { name: /import tickets from github/i })).toBeTruthy()
  })
})
