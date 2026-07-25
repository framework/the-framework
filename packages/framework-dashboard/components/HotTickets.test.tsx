import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { HotTicket, HotBucket } from '@gemstack/the-framework'

// HotTickets reads onHotTickets over the telefunc shim; stub it so the import graph stays out of
// telefunc and the poll returns fixtures.
const onHotTickets = vi.hoisted(() => vi.fn())
vi.mock('../server/reads.telefunc.js', () => ({ onHotTickets }))

const { HotTickets } = await import('./HotTickets.js')

afterEach(cleanup)

const ht = (file: string, projectName: string, bucket: HotBucket, over: Record<string, unknown> = {}): HotTicket => ({
  projectId: projectName,
  projectName,
  bucket,
  ticket: { file, title: file.replace('.md', ''), summary: '', spiked: false, planned: false, ...over },
})

describe('HotTickets (#1112)', () => {
  test('with no tickets it shows a hint', async () => {
    onHotTickets.mockResolvedValue([])
    render(<HotTickets onSelectRun={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('No tickets yet.')).toBeTruthy())
  })

  test('groups tickets into the three lanes', async () => {
    onHotTickets.mockResolvedValue([
      ht('a.md', 'alpha', 'in-progress', { planned: true }),
      ht('b.md', 'beta', 'high-priority', { priority: 'high' }),
      ht('c.md', 'alpha', 'ai-queue'),
    ])
    render(<HotTickets onSelectRun={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('a')).toBeTruthy())
    expect(screen.getByText('In progress')).toBeTruthy()
    expect(screen.getByText('AI Queue')).toBeTruthy()
    expect(screen.getByText('High priority')).toBeTruthy()
    expect(screen.getByText('b')).toBeTruthy()
    expect(screen.getByText('c')).toBeTruthy()
  })

  test('a ticket a run is implementing right now says so, over its plan/spike (#1117)', async () => {
    onHotTickets.mockResolvedValue([
      { ...ht('a.md', 'alpha', 'in-progress', { planned: true }), runId: 'run-7' },
      ht('b.md', 'alpha', 'in-progress', { planned: true }),
    ])
    render(<HotTickets onSelectRun={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('a')).toBeTruthy())
    // Live work outranks the mark older work left behind, so the same lane can say which is which.
    expect(screen.getByText('implementing')).toBeTruthy()
    expect(screen.getByText('planned')).toBeTruthy()
  })

  test('a ticket being implemented with no plan or spike still gets a tag (#1117)', async () => {
    // The gap the run link opens up: in-progress used to imply planned-or-spiked, so a bare
    // implementing ticket would have shown an unexplained row.
    onHotTickets.mockResolvedValue([{ ...ht('a.md', 'alpha', 'in-progress'), runId: 'run-7' }])
    render(<HotTickets onSelectRun={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('implementing')).toBeTruthy())
  })
})

describe('only a ticket that names a run is a link (#1139)', () => {
  test('an implemented ticket opens its session', async () => {
    // The in-progress lane exists because a run said it is implementing this ticket (#1117), so
    // the session it names is what the row is reporting on.
    onHotTickets.mockResolvedValue([{ ...ht('a.md', 'alpha', 'in-progress'), runId: 'run-9' }])
    const onSelectRun = vi.fn()
    render(<HotTickets onSelectRun={onSelectRun} />)
    fireEvent.click(await screen.findByText('a'))
    expect(onSelectRun).toHaveBeenCalledWith('alpha', 'run-9')
  })

  test('a ticket with no run is a glance, not a link', async () => {
    // No session to open and no ticket view to deep-link to, so the row is not interactive — rather
    // than a link to the project launcher, the odd redirect the #1139 thread called out.
    onHotTickets.mockResolvedValue([ht('b.md', 'beta', 'ai-queue')])
    const onSelectRun = vi.fn()
    render(<HotTickets onSelectRun={onSelectRun} />)
    const row = await screen.findByText('b')
    expect(row.closest('button')).toBeNull()
    fireEvent.click(row)
    expect(onSelectRun).not.toHaveBeenCalled()
  })
})
