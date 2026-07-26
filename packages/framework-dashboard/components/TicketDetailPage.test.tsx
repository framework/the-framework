import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const onTicket = vi.hoisted(() => vi.fn())
vi.mock('../server/reads.telefunc.js', () => ({ onTicket }))
const sendQueueTicket = vi.hoisted(() => vi.fn())
vi.mock('../server/control.telefunc.js', () => ({ sendQueueTicket }))

const { TicketDetailPage } = await import('./TicketDetailPage.js')

const ticket = (over: Record<string, unknown> = {}) => ({
  file: '2026-07-20_do-the-thing.md',
  title: 'Do the thing',
  summary: 'The thing is not done.',
  spiked: false,
  planned: false,
  content: '# Do the thing\n\n## TLDR\n\nThe thing is not done.\n\nMore detail below the fold.',
  ...over,
})

afterEach(() => {
  cleanup()
  onTicket.mockReset()
  sendQueueTicket.mockReset()
})

// One ticket's own page (#1144): the entire file, read by the same slug the list row and the
// route carry, plus the Queue action the one-liner list no longer has room for.
describe('TicketDetailPage (#1144)', () => {
  test('reads the ticket by slug and renders its full content', async () => {
    onTicket.mockResolvedValue(ticket({ priority: 'high', planned: true }))
    render(<TicketDetailPage projectId="p1" slug="2026-07-20_do-the-thing.md" onBack={() => {}} />)
    // The title heads the page, and the markdown body repeats it as its own `# ` heading — two
    // matches for the bare text, so assert the page's own heading specifically.
    expect(await screen.findByRole('heading', { name: 'Do the thing' })).toBeTruthy()
    expect(screen.getByText('More detail below the fold.')).toBeTruthy()
    expect(screen.getByText('high')).toBeTruthy()
    expect(screen.getByText('planned')).toBeTruthy()
    expect(onTicket).toHaveBeenCalledWith('p1', '2026-07-20_do-the-thing.md')
  })

  test('queueing writes it to the queue, with the ticket it came from (#1164)', async () => {
    onTicket.mockResolvedValue(ticket({ priority: 'high' }))
    sendQueueTicket.mockResolvedValue({ ok: true, file: 'TODO_AGENTS.md' })
    render(<TicketDetailPage projectId="p1" slug="2026-07-20_do-the-thing.md" onBack={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: /queue/i }))
    await waitFor(() =>
      expect(sendQueueTicket).toHaveBeenCalledWith('p1', 'Do the thing', {
        file: '2026-07-20_do-the-thing.md',
        priority: 'high',
      }),
    )
  })

  test('a queued ticket says so and cannot be queued twice', async () => {
    onTicket.mockResolvedValue(ticket())
    sendQueueTicket.mockResolvedValue({ ok: true, file: 'TODO_AGENTS.md' })
    render(<TicketDetailPage projectId="p1" slug="2026-07-20_do-the-thing.md" onBack={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: /queue/i }))
    const queued = await screen.findByRole('button', { name: /queued/i })
    expect((queued as HTMLButtonElement).disabled).toBe(true)
  })

  test('a failed queue write surfaces and leaves the button addable', async () => {
    onTicket.mockResolvedValue(ticket())
    sendQueueTicket.mockResolvedValue({ ok: false, error: 'the queue could not be written' })
    render(<TicketDetailPage projectId="p1" slug="2026-07-20_do-the-thing.md" onBack={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: /queue/i }))
    expect(await screen.findByText(/could not be written/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /queued/i })).toBeNull()
  })

  test('a missing ticket says so rather than rendering blank', async () => {
    onTicket.mockResolvedValue(null)
    render(<TicketDetailPage projectId="p1" slug="gone.md" onBack={() => {}} />)
    expect(await screen.findByText(/does not exist/i)).toBeTruthy()
  })

  test('Back returns to the list', async () => {
    onTicket.mockResolvedValue(ticket())
    const onBack = vi.fn()
    render(<TicketDetailPage projectId="p1" slug="2026-07-20_do-the-thing.md" onBack={onBack} />)
    fireEvent.click(await screen.findByRole('button', { name: /tickets/i }))
    expect(onBack).toHaveBeenCalled()
  })
})
