import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { AutoPmJob, AutoPmReport, Preferences, ProjectSummary } from '@gemstack/the-framework'
import { AUTO_PM_ROUTINES, AUTO_PM_DRAIN_JOB, AUTO_PM_MAINTENANCE_JOB } from '@gemstack/the-framework/client'
import { hoverTooltip } from '../test-utils.js'

// Everything the card reads goes through a lib module, so the mocks stop short of telefunc: an
// unmocked `*.telefunc.js` in the import graph fails as an assertIsNotBrowser bug report.
const onProjects = vi.hoisted(() => vi.fn())
vi.mock('../server/projects.telefunc.js', () => ({ onProjects }))

const sendAutoPmSweep = vi.hoisted(() => vi.fn())
vi.mock('../server/quota.telefunc.js', () => ({ sendAutoPmSweep }))

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

/** What the row shows, which is also its checkbox's label. */
const routineName = (job: AutoPmJob) => job.label ?? job.name
/** The row's own box, found through its label so the master at the foot can never be picked up instead. */
const routineBox = (job: AutoPmJob) =>
  screen.getByText(routineName(job)).closest('label')!.querySelector('[role="checkbox"]')!

beforeEach(() => {
  prefs = {}
  autoPm = undefined
  busy = false
  startError = null
  onProjects.mockResolvedValue([project('p1', 'gemstack')])
  start.mockReset()
  start.mockResolvedValue({ ok: true, runId: 'run-1' })
  updatePreferences.mockReset()
  sendAutoPmSweep.mockReset()
  sendAutoPmSweep.mockResolvedValue({ ok: true })
})
afterEach(cleanup)

describe('RoutineWork (#1159)', () => {
  test('lists every routine the sweep can fire, by its preset label', async () => {
    render(<RoutineWork onRunStarted={() => {}} />)
    await waitFor(() => expect(screen.getAllByText('Run now').length).toBe(AUTO_PM_ROUTINES.length))
    for (const job of AUTO_PM_ROUTINES) expect(screen.getByText(job.label ?? job.name)).toBeTruthy()
  })

  test('a routine that describes itself gets a line under its name; the rest are just their label', async () => {
    render(<RoutineWork onRunStarted={() => {}} />)
    await waitFor(() => expect(screen.getAllByText('Run now').length).toBe(AUTO_PM_ROUTINES.length))
    // Today that is the maintenance sweep alone, whose label does not say what it does.
    expect(screen.getByText(AUTO_PM_MAINTENANCE_JOB.describe!)).toBeTruthy()
    // A row without one is a single line: nothing else stands in as a subtitle.
    for (const job of AUTO_PM_ROUTINES) {
      const title = screen.getByText(routineName(job))
      expect(title.parentElement!.childElementCount).toBe(job.describe ? 2 : 1)
    }
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
    // One box per routine (#1209), plus the master at the foot.
    expect(screen.getAllByRole('checkbox')).toHaveLength(AUTO_PM_ROUTINES.length + 1)
    fireEvent.click(screen.getByText('Auto-run'))
    expect(updatePreferences).toHaveBeenCalledWith({ autoPm: true })
    const label = screen.getByText('Auto-run').closest('label')!
    expect((await hoverTooltip(label)).textContent).toBe('Automatically run the ticked routines on a regular schedule.')
  })

  test('every routine starts ticked, and unticking one records only that one (#1209)', async () => {
    render(<RoutineWork onRunStarted={() => {}} />)
    await waitFor(() => expect(screen.getAllByText('Run now').length).toBe(AUTO_PM_ROUTINES.length))
    // Nothing saved means nothing opted out: the schedule is whole until it is edited.
    for (const job of AUTO_PM_ROUTINES) expect(routineBox(job).getAttribute('aria-checked')).toBe('true')
    fireEvent.click(screen.getByText(routineName(AUTO_PM_DRAIN_JOB)))
    expect(updatePreferences).toHaveBeenCalledWith({ autoPmOptOut: [AUTO_PM_DRAIN_JOB.name] })
  })

  test('an opted-out routine shows unticked, and re-ticking it drops only it (#1209)', async () => {
    const other = AUTO_PM_ROUTINES[1]!.name
    prefs = { autoPmOptOut: [AUTO_PM_DRAIN_JOB.name, other] }
    render(<RoutineWork onRunStarted={() => {}} />)
    await waitFor(() => expect(screen.getAllByText('Run now').length).toBe(AUTO_PM_ROUTINES.length))
    expect(routineBox(AUTO_PM_DRAIN_JOB).getAttribute('aria-checked')).toBe('false')
    fireEvent.click(screen.getByText(routineName(AUTO_PM_DRAIN_JOB)))
    // The other opt-out survives: the row writes the whole set, so it must not clear its siblings.
    expect(updatePreferences).toHaveBeenCalledWith({ autoPmOptOut: [other] })
  })

  test('Run now ignores the checkbox: it fires the routine once, on demand (#1209)', async () => {
    prefs = { autoPmOptOut: AUTO_PM_ROUTINES.map(job => job.name) }
    render(<RoutineWork onRunStarted={() => {}} />)
    await waitFor(() => expect(screen.getAllByText('Run now').length).toBe(AUTO_PM_ROUTINES.length))
    for (const button of screen.getAllByText('Run now')) expect((button as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(screen.getAllByText('Run now')[0]!)
    await waitFor(() => expect(start).toHaveBeenCalled())
    expect(start.mock.calls[0]![1]).toBe(AUTO_PM_DRAIN_JOB.prompt)
  })

  test('auto-run on with nothing ticked says so, rather than counting down to nothing (#1209)', async () => {
    prefs = { autoPm: true, autoPmOptOut: AUTO_PM_ROUTINES.map(job => job.name) }
    render(<RoutineWork onRunStarted={() => {}} />)
    await waitFor(() => expect(screen.getByText(/Every routine is unticked/)).toBeTruthy())
    cleanup()
    // One routine back on and the warning goes: the schedule has something to do again.
    prefs = { autoPm: true, autoPmOptOut: AUTO_PM_ROUTINES.slice(1).map(job => job.name) }
    render(<RoutineWork onRunStarted={() => {}} />)
    await waitFor(() => expect(screen.getByText('Auto-run')).toBeTruthy())
    expect(screen.queryByText(/Every routine is unticked/)).toBeNull()
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

  test('Trigger routine now fires the sweep instead of waiting out the countdown (#1210)', async () => {
    prefs = { autoPm: true }
    render(<RoutineWork onRunStarted={() => {}} />)
    const button = await screen.findByText('Trigger routine now')
    fireEvent.click(button)
    await waitFor(() => expect(sendAutoPmSweep).toHaveBeenCalledTimes(1))
  })

  test('with auto-run off the trigger is disabled, since a sweep would just stand down (#1210)', async () => {
    prefs = { autoPm: false }
    render(<RoutineWork onRunStarted={() => {}} />)
    const button = await screen.findByText('Trigger routine now')
    expect(button.closest('button')!.disabled).toBe(true)
    fireEvent.click(button)
    expect(sendAutoPmSweep).not.toHaveBeenCalled()
  })

  test('a host with no sweep says so rather than looking like it worked (#1210)', async () => {
    prefs = { autoPm: true }
    sendAutoPmSweep.mockResolvedValue({ ok: false })
    render(<RoutineWork onRunStarted={() => {}} />)
    fireEvent.click(await screen.findByText('Trigger routine now'))
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/not running the sweep/i))
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
