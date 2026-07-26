import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { AutoPmReport, Preferences, ProjectSummary } from '@gemstack/the-framework'
import { AUTO_PM_ROUTINES, AUTO_PM_DRAIN_JOB } from '@gemstack/the-framework/client'
import { hoverTooltip } from '../test-utils.js'

// Everything the card reads goes through a lib module, so the mocks stop short of telefunc: an
// unmocked `*.telefunc.js` in the import graph fails as an assertIsNotBrowser bug report.
const onProjects = vi.hoisted(() => vi.fn())
vi.mock('../server/projects.telefunc.js', () => ({ onProjects }))

const updatePreferences = vi.hoisted(() => vi.fn())
let prefs: Preferences = {}
vi.mock('../lib/preferences.js', () => ({ usePreferences: () => prefs, updatePreferences }))

let autoPm: AutoPmReport | undefined
vi.mock('../lib/quota.js', () => ({ useAutoPm: () => autoPm, useQuota: () => undefined }))

const start = vi.hoisted(() => vi.fn())
let busy = false
let startError: string | null = null
vi.mock('../lib/use-start-run.js', () => ({
  useStartRun: () => ({ busy, error: startError, reset: () => {}, start }),
}))

const { RoutineWork } = await import('./RoutineWork.js')

const project = (id: string, name: string): ProjectSummary => ({ id, path: `/repos/${name}`, name, activated: true })

beforeEach(() => {
  prefs = {}
  autoPm = undefined
  busy = false
  startError = null
  onProjects.mockResolvedValue([project('p1', 'gemstack')])
  start.mockReset()
  start.mockResolvedValue({ ok: true, runId: 'run-1' })
  updatePreferences.mockReset()
})
afterEach(cleanup)

describe('RoutineWork (#1159)', () => {
  test('lists every routine the sweep can fire, by its preset label', async () => {
    render(<RoutineWork onRunStarted={() => {}} />)
    await waitFor(() => expect(screen.getAllByText('Run now').length).toBe(AUTO_PM_ROUTINES.length))
    for (const job of AUTO_PM_ROUTINES) expect(screen.getByText(job.label ?? job.name)).toBeTruthy()
  })

  test('Run now starts the routine prompt verbatim and selects the run it started (#1191)', async () => {
    const started: unknown[][] = []
    render(<RoutineWork onRunStarted={(...args) => started.push(args)} />)
    await waitFor(() => expect(screen.getAllByText('Run now').length).toBeGreaterThan(0))
    fireEvent.click(screen.getAllByText('Run now')[0]!)
    // The drain job leads the list, and its prompt travels unchanged: this is the fast-forward.
    await waitFor(() => expect(start).toHaveBeenCalled())
    const [projectId, prompt, kind] = start.mock.calls[0]!
    expect(projectId).toBe('p1')
    expect(prompt).toBe(AUTO_PM_DRAIN_JOB.prompt)
    expect(kind).toBe('prompt')
    // The run id is the whole point: without it the shell renders the launcher, so "Run now"
    // landed on an empty composer with its own session nowhere on screen (#1191).
    await waitFor(() => expect(started).toHaveLength(1))
    expect(started[0]).toEqual(['p1', AUTO_PM_DRAIN_JOB.prompt, 'run-1'])
  })

  test('a start that reports no run id still hands the project over, for the adopt fallback (#1191)', async () => {
    start.mockResolvedValue({ ok: true })
    const started: unknown[][] = []
    render(<RoutineWork onRunStarted={(...args) => started.push(args)} />)
    await waitFor(() => expect(screen.getAllByText('Run now').length).toBeGreaterThan(0))
    fireEvent.click(screen.getAllByText('Run now')[0]!)
    await waitFor(() => expect(started).toHaveLength(1))
    expect(started[0]).toEqual(['p1', AUTO_PM_DRAIN_JOB.prompt, undefined])
  })

  test('a failed start neither navigates nor leaves the button stuck on Starting', async () => {
    start.mockResolvedValue(undefined)
    startError = 'A session is already active for this project.'
    const started: unknown[][] = []
    render(<RoutineWork onRunStarted={(...args) => started.push(args)} />)
    await waitFor(() => expect(screen.getAllByText('Run now').length).toBeGreaterThan(0))
    fireEvent.click(screen.getAllByText('Run now')[0]!)
    await waitFor(() => expect(start).toHaveBeenCalled())
    expect(started).toHaveLength(0)
    await waitFor(() => expect(screen.queryByText('Starting…')).toBeNull())
    expect(screen.getByRole('alert').textContent).toMatch(/already active/)
  })

  test('with auto-run on and a reported sweep, the box says when it next runs', async () => {
    prefs = { autoPm: true }
    autoPm = { enabled: true, sweptAt: Date.now(), nextSweepAt: Date.now() + 2 * 60 * 60_000, outcomes: [] }
    render(<RoutineWork onRunStarted={() => {}} />)
    await waitFor(() => expect(screen.getByText('Auto-runs in 2 hr')).toBeTruthy())
  })

  test('with auto-run off, or before the daemon has reported, it says only what it does', async () => {
    prefs = { autoPm: true }
    autoPm = undefined
    const { rerender } = render(<RoutineWork onRunStarted={() => {}} />)
    // On, but no sweep has reported yet: a countdown here would be invented.
    await waitFor(() => expect(screen.getByText('Auto-run')).toBeTruthy())
    prefs = {}
    rerender(<RoutineWork onRunStarted={() => {}} />)
    expect(screen.getByText('Auto-run')).toBeTruthy()
  })

  test('the checkbox is the one global preference, and carries the tooltip', async () => {
    render(<RoutineWork onRunStarted={() => {}} />)
    await waitFor(() => expect(screen.getByText('Auto-run')).toBeTruthy())
    // One box for the whole card (#1159): a per-routine box flipping a global switch would lie.
    expect(screen.getAllByRole('checkbox')).toHaveLength(1)
    fireEvent.click(screen.getByText('Auto-run'))
    expect(updatePreferences).toHaveBeenCalledWith({ autoPm: true })
    const label = screen.getByText('Auto-run').closest('label')!
    expect((await hoverTooltip(label)).textContent).toBe('Automatically run this prompt on a regular schedule.')
  })

  test('several projects get a picker, and Run now honours it', async () => {
    onProjects.mockResolvedValue([project('p1', 'gemstack'), project('p2', 'rudder')])
    render(<RoutineWork onRunStarted={() => {}} />)
    const select = await screen.findByLabelText('Run in')
    fireEvent.change(select, { target: { value: 'p2' } })
    fireEvent.click(screen.getAllByText('Run now')[0]!)
    await waitFor(() => expect(start).toHaveBeenCalled())
    expect(start.mock.calls[0]![0]).toBe('p2')
  })

  test('one project needs no picker', async () => {
    render(<RoutineWork onRunStarted={() => {}} />)
    await waitFor(() => expect(screen.getAllByText('Run now').length).toBeGreaterThan(0))
    expect(screen.queryByLabelText('Run in')).toBeNull()
  })

  test('with no project there is nothing to run a routine in, and it says so', async () => {
    onProjects.mockResolvedValue([])
    render(<RoutineWork onRunStarted={() => {}} />)
    await waitFor(() => expect(screen.getByText('Add a project to run a routine.')).toBeTruthy())
    expect(screen.queryByText('Run now')).toBeNull()
  })

  test('a start already in flight disables every Run now', async () => {
    busy = true
    render(<RoutineWork onRunStarted={() => {}} />)
    await waitFor(() => expect(screen.getAllByText('Run now').length).toBeGreaterThan(0))
    for (const button of screen.getAllByText('Run now')) expect((button as HTMLButtonElement).disabled).toBe(true)
  })
})
