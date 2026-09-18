import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ProjectScheduler } from '../../src/index.js'

// The card reads onSchedulers over the RPC stub; stub it so nothing fetches a daemon that is not
// there and the poll returns fixtures.
const onSchedulers = vi.hoisted(() => vi.fn())
vi.mock('../rpc/reads.js', () => ({ onSchedulers }))

const { SchedulerCard, schedulerStatus } = await import('./SchedulerCard.js')

afterEach(cleanup)

const row = (projectName: string, over: Partial<ProjectScheduler> = {}): ProjectScheduler => ({
  projectId: projectName,
  projectName,
  present: true,
  on: true,
  keepAlive: false,
  running: true,
  model: 'opus',
  commands: [],
  ...over,
})

/** A project with no state file at all: nothing to show but its name. */
const notSetUp = (projectName: string): ProjectScheduler => ({ projectId: projectName, projectName, present: false, on: false, keepAlive: false, running: false, commands: [] })

describe('SchedulerCard (#1774)', () => {
  test('one word per state: not set up, off, on but its process gone, on', () => {
    expect(schedulerStatus(notSetUp('p')).label).toBe('not set up')
    expect(schedulerStatus(row('p', { on: false, running: false })).label).toBe('off')
    expect(schedulerStatus(row('p', { on: true, running: false })).label).toBe('on, not running')
    expect(schedulerStatus(row('p', { on: true, running: true })).label).toBe('on')
  })

  test('says it is loading, then one row per project with its status, keep-alive and model', async () => {
    onSchedulers.mockResolvedValue([
      row('gemstack', { keepAlive: true }),
      notSetUp('other'),
    ])
    render(<SchedulerCard onSelectAgent={() => {}} />)
    expect(screen.getByText('Loading…')).toBeTruthy()
    await waitFor(() => expect(screen.getByText('gemstack')).toBeTruthy())
    expect(screen.getByText('on')).toBeTruthy()
    expect(screen.getByText('keep-alive')).toBeTruthy()
    expect(screen.getByText('opus')).toBeTruthy()
    expect(screen.getByText('other')).toBeTruthy()
    expect(screen.getByText('not set up')).toBeTruthy()
  })

  test("the last tick's lines read as the tool wrote them, and a started run opens its agent", async () => {
    onSchedulers.mockResolvedValue([
      row('gemstack', {
        lastTick: {
          at: new Date(Date.now() - 90_000).toISOString(),
          decisions: [
            { command: 'work-queue', outcome: 'started 2026-09-16T16-47-27-780Z', run: '2026-09-16T16-47-27-780Z' },
            { command: 'triage', outcome: 'not due' },
          ],
        },
      }),
      row('quiet', { on: false, running: false, lastTick: { at: new Date().toISOString(), decisions: [], note: 'no agent-schedule.md' } }),
    ])
    const opened: string[][] = []
    render(<SchedulerCard onSelectAgent={(...args) => opened.push(args)} />)
    await waitFor(() => expect(screen.getByText('1m ago')).toBeTruthy())
    expect(screen.getByText('triage: not due')).toBeTruthy()
    expect(screen.getByText(/no agent-schedule\.md/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'work-queue: started 2026-09-16T16-47-27-780Z' }))
    expect(opened).toEqual([['gemstack', '2026-09-16T16-47-27-780Z']])
    // A line that started nothing is not a button.
    expect(screen.queryByRole('button', { name: 'triage: not due' })).toBeNull()
  })

  test('with no registered project it says so', async () => {
    onSchedulers.mockResolvedValue([])
    render(<SchedulerCard onSelectAgent={() => {}} />)
    await waitFor(() => expect(screen.getByText('No projects.')).toBeTruthy())
  })
})
