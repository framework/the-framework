import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { HotTicket, HotBucket } from '../../dist/index.js'

// HotTickets reads onHotTickets over the telefunc shim; stub it so the import graph stays out of
// telefunc and the poll returns fixtures.
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
    render(<HotTickets onSelectProject={() => {}} onSelectRun={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('Nothing in progress, queued, or high priority.')).toBeTruthy())
  })

  test('groups tickets into the three lanes and selecting one jumps into its project', async () => {
    onHotTickets.mockResolvedValue([
      ht('a.md', 'alpha', 'in-progress', { planned: true }),
      ht('b.md', 'beta', 'high-priority', { priority: 'high' }),
      ht('c.md', 'alpha', 'ai-queue'),
    ])
    let picked: string | null = null
    render(<HotTickets onSelectProject={id => (picked = id)} onSelectRun={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('a')).toBeTruthy())
    expect(screen.getByText('In progress')).toBeTruthy()
    expect(screen.getByText('AI Queue')).toBeTruthy()
    expect(screen.getByText('High priority')).toBeTruthy()
    fireEvent.click(screen.getByText('b'))
    expect(picked).toBe('beta')
  })

  test('a ticket a run is implementing right now says so, over its plan/spike (#1117)', async () => {
    onHotTickets.mockResolvedValue([
      { ...ht('a.md', 'alpha', 'in-progress', { planned: true }), agentId: 'run-7' },
      ht('b.md', 'alpha', 'in-progress', { planned: true }),
    ])
    render(<HotTickets onSelectProject={() => {}} onSelectRun={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('a')).toBeTruthy())
    // Live work outranks the mark older work left behind, so the same lane can say which is which.
    expect(screen.getByText('implementing')).toBeTruthy()
    expect(screen.getByText('planned')).toBeTruthy()
  })

  test('a ticket being implemented with no plan or spike still gets a tag (#1117)', async () => {
    // The gap the run link opens up: in-progress used to imply planned-or-spiked, so a bare
    // implementing ticket would have shown an unexplained row.
    onHotTickets.mockResolvedValue([{ ...ht('a.md', 'alpha', 'in-progress'), agentId: 'run-7' }])
    render(<HotTickets onSelectProject={() => {}} onSelectRun={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('implementing')).toBeTruthy())
  })
})

describe('a hot ticket that names a run opens that run', () => {
  test('an implemented ticket goes to its session, not its project home', async () => {
    // The in-progress lane exists because a run said it is implementing this ticket (#1117), so
    // the session it names is what the row is reporting on.
    onHotTickets.mockResolvedValue([{ ...ht('a.md', 'alpha', 'in-progress'), agentId: 'run-9' }])
    const onSelectRun = vi.fn()
    const onSelectProject = vi.fn()
    render(<HotTickets onSelectProject={onSelectProject} onSelectRun={onSelectRun} />)
    fireEvent.click(await screen.findByText('a'))
    expect(onSelectRun).toHaveBeenCalledWith('alpha', 'run-9')
    expect(onSelectProject).not.toHaveBeenCalled()
  })

  test('a ticket with no run still goes to its project', async () => {
    onHotTickets.mockResolvedValue([ht('b.md', 'beta', 'ai-queue')])
    const onSelectRun = vi.fn()
    const onSelectProject = vi.fn()
    render(<HotTickets onSelectProject={onSelectProject} onSelectRun={onSelectRun} />)
    fireEvent.click(await screen.findByText('b'))
    expect(onSelectProject).toHaveBeenCalledWith('beta')
    expect(onSelectRun).not.toHaveBeenCalled()
  })
})

describe('a hot ticket with no run prefills the launcher it lands on', () => {
  test('the click carries the ticket over as a composer draft', async () => {
    onHotTickets.mockResolvedValue([ht('b.md', 'beta', 'ai-queue')])
    render(<HotTickets onSelectProject={vi.fn()} onSelectRun={vi.fn()} />)
    fireEvent.click(await screen.findByText('b'))
    // Without this the row was a dead end: the launcher came up empty and the one fact the row
    // carried — which ticket — was dropped. Composer takes this at mount (#1066).
    expect(takePendingDraft()).toBe(workOnTicketDraft('b.md'))
  })

  test('the draft names the ticket file, not its title', async () => {
    // The title is prose the agent would have to search for; the file is the ticket's identity.
    expect(workOnTicketDraft('add-oauth.md')).toContain('tickets/add-oauth.md')
  })

  test('a ticket that opens a live session leaves no draft behind', async () => {
    onHotTickets.mockResolvedValue([{ ...ht('a.md', 'alpha', 'in-progress'), agentId: 'run-9' }])
    render(<HotTickets onSelectProject={vi.fn()} onSelectRun={vi.fn()} />)
    fireEvent.click(await screen.findByText('a'))
    // That click goes to a session, not a launcher, so a draft stashed here would surface later
    // on the next unrelated visit to one.
    expect(takePendingDraft()).toBeNull()
  })
})
