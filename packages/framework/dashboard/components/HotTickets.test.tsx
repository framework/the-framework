import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { HotTicket, HotBucket } from '../../src/index.js'

// HotTickets reads onHotTickets over the RPC stub; stub it so nothing fetches a daemon that is
// not there and the poll returns fixtures.
const onHotTickets = vi.hoisted(() => vi.fn())
vi.mock('../rpc/reads.js', () => ({ onHotTickets }))

const { HotTickets, workOnTicketDraft } = await import('./HotTickets.js')
const { takePendingDraft } = await import('../lib/draft-handoff.js')

afterEach(() => {
  cleanup()
  // The draft stash outlives a render, so a leftover would leak into the next test's assertion.
  takePendingDraft()
})

const ht = (file: string, projectName: string, bucket: HotBucket, over: Record<string, unknown> = {}): HotTicket => ({
  projectId: projectName,
  projectName,
  bucket,
  ticket: { file, title: file.replace('.md', ''), summary: '', date: '2026-01-01T00:00:00.000Z', planned: false, ...over },
})

describe('HotTickets (#1112)', () => {
  test('with no hot tickets it names the empty lanes rather than claiming no tickets exist', async () => {
    onHotTickets.mockResolvedValue([])
    render(<HotTickets onSelectProject={() => {}} />)
    await waitFor(() => expect(screen.getByText('Nothing in progress, queued, or high priority.')).toBeTruthy())
  })

  test('groups tickets into the three lanes and selecting one jumps into its project', async () => {
    onHotTickets.mockResolvedValue([
      ht('a.md', 'alpha', 'in-progress', { planned: true }),
      ht('b.md', 'beta', 'high-priority', { priority: 'high' }),
      ht('c.md', 'alpha', 'ai-queue'),
    ])
    let picked: string | null = null
    render(<HotTickets onSelectProject={id => (picked = id)} />)
    await waitFor(() => expect(screen.getByText('a')).toBeTruthy())
    expect(screen.getByText('In progress')).toBeTruthy()
    expect(screen.getByText('AI Queue')).toBeTruthy()
    expect(screen.getByText('High priority')).toBeTruthy()
    fireEvent.click(screen.getByText('b'))
    expect(picked).toBe('beta')
  })
})

describe('a hot ticket with no run prefills the launcher it lands on', () => {
  test('the click carries the ticket over as a composer draft', async () => {
    onHotTickets.mockResolvedValue([ht('b.md', 'beta', 'ai-queue')])
    render(<HotTickets onSelectProject={vi.fn()} />)
    fireEvent.click(await screen.findByText('b'))
    // Without this the row was a dead end: the launcher came up empty and the one fact the row
    // carried — which ticket — was dropped. Composer takes this at mount (#1066).
    expect(takePendingDraft()).toBe(workOnTicketDraft('b.md'))
  })

  test('the draft names the ticket file, not its title', async () => {
    // The title is prose the agent would have to search for; the file is the ticket's identity.
    expect(workOnTicketDraft('add-oauth.md')).toContain('tickets/add-oauth.md')
  })
})
