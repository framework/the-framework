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
    render(<HotTickets onSelectProject={() => {}} onSelectRun={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('No tickets yet.')).toBeTruthy())
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
      { ...ht('a.md', 'alpha', 'in-progress', { planned: true }), runId: 'run-7' },
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
    onHotTickets.mockResolvedValue([{ ...ht('a.md', 'alpha', 'in-progress'), runId: 'run-7' }])
    render(<HotTickets onSelectProject={() => {}} onSelectRun={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('implementing')).toBeTruthy())
  })
})

describe('a hot ticket that names a run opens that run', () => {
  test('an implemented ticket goes to its session, not its project home', async () => {
    // The in-progress lane exists because a run said it is implementing this ticket (#1117), so
    // the session it names is what the row is reporting on.
    onHotTickets.mockResolvedValue([{ ...ht('a.md', 'alpha', 'in-progress'), runId: 'run-9' }])
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
