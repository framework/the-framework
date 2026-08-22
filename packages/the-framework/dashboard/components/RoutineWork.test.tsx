import type { ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { AutoPmJob, AutoPmReport, Preferences, ProjectSummary } from '../../src/index.js'
import {
  AUTO_PM_ROUTINES,
  AUTO_PM_DRAIN_JOB,
  AUTO_PM_MAINTENANCE_JOB,
  DEFAULT_AUTO_PM_CONCURRENCY,
  MAX_AUTO_PM_CONCURRENCY,
} from '../../src/client.js'
import { hoverTooltip } from '../test-utils.js'

// Everything the card reads goes through a lib module, so the mocks stop at the `rpc/` stubs: an
// unmocked one reaches for `/_rpc/<name>`, and there is no daemon behind jsdom to answer.
const onProjects = vi.hoisted(() => vi.fn())
vi.mock('../rpc/projects.js', () => ({ onProjects }))

const sendAutoPmSweep = vi.hoisted(() => vi.fn())
vi.mock('../rpc/quota.js', () => ({ sendAutoPmSweep }))

const updatePreferences = vi.hoisted(() => vi.fn())
let prefs: Preferences = {}
vi.mock('../lib/preferences.js', () => ({ usePreferences: () => prefs, updatePreferences }))

let autoPm: AutoPmReport | undefined
vi.mock('../lib/quota.js', () => ({ useAutoPm: () => autoPm, useQuota: () => undefined }))

const start = vi.hoisted(() => vi.fn())
let busy = false
let startError: string | null = null
vi.mock('../lib/use-start-agent.js', () => ({
  useStartAgent: () => ({ busy, error: startError, reset: () => {}, start }),
}))

const { RoutineWork } = await import('./RoutineWork.js')
const { takePendingDraft } = await import('../lib/draft-handoff.js')

/** The card with both navigation props filled in; a test overrides only the one it asserts on. */
const renderCard = (props: Partial<ComponentProps<typeof RoutineWork>> = {}) =>
  render(<RoutineWork onAgentStarted={() => {}} onSelectProject={() => {}} {...props} />)

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
  start.mockResolvedValue({ ok: true, agentId: 'run-1' })
  updatePreferences.mockReset()
  sendAutoPmSweep.mockReset()
  sendAutoPmSweep.mockResolvedValue({ ok: true })
})
afterEach(cleanup)

describe('RoutineWork (#1159)', () => {
  test('lists every routine the sweep can fire, by its preset label', async () => {
    renderCard()
    await waitFor(() => expect(screen.getAllByText('Run now').length).toBe(AUTO_PM_ROUTINES.length))
    for (const job of AUTO_PM_ROUTINES) expect(screen.getByText(job.label ?? job.name)).toBeTruthy()
  })

  test('a routine that describes itself gets a line under its name; the rest are just their label', async () => {
    renderCard()
    await waitFor(() => expect(screen.getAllByText('Run now').length).toBe(AUTO_PM_ROUTINES.length))
    // Today that is the maintenance sweep alone, whose label does not say what it does.
    expect(screen.getByText(AUTO_PM_MAINTENANCE_JOB.describe!)).toBeTruthy()
    // A row without one is a single line: nothing else stands in as a subtitle.
    for (const job of AUTO_PM_ROUTINES) {
      const title = screen.getByText(routineName(job))
      expect(title.parentElement!.childElementCount).toBe(job.describe ? 2 : 1)
    }
  })

  // The drain leads the list, and since #1204 its Run now goes to the sweep, so the plain-start
  // tests click the first *rotation* row instead.
  const ROTATION_JOB = AUTO_PM_ROUTINES[1]!

  test('Run now starts the routine prompt verbatim and selects the run it started (#1191)', async () => {
    const started: unknown[][] = []
    renderCard({ onAgentStarted: (...args) => started.push(args) })
    await waitFor(() => expect(screen.getAllByText('Run now').length).toBeGreaterThan(0))
    fireEvent.click(screen.getAllByText('Run now')[1]!)
    await waitFor(() => expect(start).toHaveBeenCalled())
    const [projectId, prompt, kind, options] = start.mock.calls[0]!
    expect(projectId).toBe('p1')
    expect(prompt).toBe(ROTATION_JOB.prompt)
    expect(kind).toBe('prompt')
    // Unattended (#1279): a card-fired routine ends at settle and its handoff fires, like the
    // sweep's own runs, instead of parking in the stay-open chat loop.
    expect(options).toMatchObject({ unattended: true })
    // The agent id is the whole point: without it the shell renders the launcher, so "Run now"
    // landed on an empty composer with its own session nowhere on screen (#1191).
    await waitFor(() => expect(started).toHaveLength(1))
    expect(started[0]).toEqual(['p1', ROTATION_JOB.prompt, 'run-1'])
  })

  /** One row's Run now, by its place in the list the card renders. */
  const runNowOf = async (job: AutoPmJob) => {
    await waitFor(() => expect(screen.getAllByText('Run now').length).toBe(AUTO_PM_ROUTINES.length))
    return screen.getAllByText('Run now')[AUTO_PM_ROUTINES.indexOf(job)]!.closest('button')!
  }

  test('Run now says what the routine does and the settings its start would use (#1506)', async () => {
    prefs = { model: 'opus' }
    renderCard()
    const hint = await hoverTooltip(await runNowOf(ROTATION_JOB))
    // The preset's own sentence, not a second one written for this card: the launcher describes
    // the same routine with the same words.
    expect(hint.textContent).toContain(ROTATION_JOB.tooltip)
    // The three facts the card cannot otherwise show, because all three live in the Global
    // options on another page — and the model is the one this start would really pass.
    expect(hint.textContent).toContain('Claude Code · Opus · This machine')
    expect(hint.textContent).toMatch(/Starts one agent in gemstack, unattended/)
  })

  test('no model pinned is said as such, never as the first one in the list (#1143/#1506)', async () => {
    renderCard()
    expect((await hoverTooltip(await runNowOf(ROTATION_JOB))).textContent).toContain("the CLI's own default")
    cleanup()
    // A model pinned on the *other* driver is not this driver's model either, so naming it would
    // name something the agent is never passed.
    prefs = { driver: 'claude', model: 'gpt-5' }
    renderCard()
    const hint = await hoverTooltip(await runNowOf(ROTATION_JOB))
    expect(hint.textContent).toContain("the CLI's own default")
    expect(hint.textContent).not.toContain('GPT-5')
  })

  test('where it runs is read off the preference, not assumed to be this machine (#1506)', async () => {
    prefs = { target: 'web' }
    renderCard()
    expect((await hoverTooltip(await runNowOf(ROTATION_JOB))).textContent).toContain('Claude web')
  })

  test("the drain's Run now reports the sweep it fires, not these settings (#1506)", async () => {
    prefs = { model: 'opus', autoPmConcurrency: 3 }
    renderCard()
    const hint = await hoverTooltip(await runNowOf(AUTO_PM_DRAIN_JOB))
    // The sweep visits every project and resolves each one's own committed settings on top of
    // these, so the model and place the other rows promise would both be a guess here.
    expect(hint.textContent).toContain("Each project's own settings decide the model and where it runs.")
    expect(hint.textContent).toMatch(/Sweeps every project the daemon watches, up to 3 agents each, unattended/)
    expect(hint.textContent).not.toContain('Opus')
  })

  test("the planning routine's menu item says it is one agent too, not its fan-out (#1204/#1507)", async () => {
    renderCard()
    await openRunMenu(AUTO_PM_ROUTINES.find(job => job.fansOut)!)
    // The launcher sends one agent whichever routine it is handed, so the moment a Run now stops
    // being one start its menu item has to say what it gives up.
    expect(await screen.findByText(/one agent, not the fan-out/)).toBeTruthy()
  })

  // #1204: the planning routine is the other one that fans out, so its Run now goes to the sweep
  // too — a plain start could only ever be one agent, which is the one thing the concurrency
  // setting could not reach.
  const PLAN_JOB = AUTO_PM_ROUTINES.find(job => job.fansOut)!

  test("the planning routine's Run now fires the sweep for its project, not a single start (#1204)", async () => {
    renderCard()
    fireEvent.click(await runNowOf(PLAN_JOB))
    await waitFor(() => expect(sendAutoPmSweep).toHaveBeenCalled())
    // Narrowed to planning, and scoped to the project the picker shows: the drain's Run now
    // deliberately sends no id because it sweeps every project, and this one is not that.
    expect(sendAutoPmSweep).toHaveBeenCalledWith({ only: 'plan', projectId: 'p1' })
    // The fan-out is the sweep's whole point here: a plain start is the pre-#1204 behaviour and
    // is exactly what must not happen.
    expect(start).not.toHaveBeenCalled()
  })

  test("the planning routine's Run now says it spends the concurrency, one agent per ticket (#1204)", async () => {
    prefs = { model: 'opus', autoPmConcurrency: 3 }
    renderCard()
    const hint = await hoverTooltip(await runNowOf(PLAN_JOB))
    expect(hint.textContent).toMatch(/Starts up to 3 agents in gemstack, one per open ticket, unattended/)
    // Not the drain's line: this one stays in the picked project and does resolve these settings.
    expect(hint.textContent).not.toContain('Sweeps every project')
    expect(hint.textContent).toContain('Claude Code · Opus · This machine')
  })

  test('a concurrency of one is said as one agent, not "up to 1 agents" (#1204)', async () => {
    prefs = { autoPmConcurrency: 1 }
    renderCard()
    expect((await hoverTooltip(await runNowOf(PLAN_JOB))).textContent).toMatch(/Starts up to 1 agent in gemstack/)
  })

  // #1643: a routine pinned to a branch goes through the sweep too — one agent still, but the
  // sweep releases a stale copy of its branch before the start, and a plain start never did: the
  // agent read the leftover as a triage already pending and aborted, on every click.
  test("a pinned routine's Run now asks the sweep for it by its branch, not a plain start (#1643)", async () => {
    const pinned = AUTO_PM_ROUTINES.filter(job => job.pinnedBranch !== undefined)
    expect(pinned.length).toBeGreaterThan(0)
    renderCard()
    for (const job of pinned) {
      fireEvent.click(await runNowOf(job))
      // By the branch the job declares, never its name, and scoped to the picked project like
      // the plan click: the routine is that project's own work.
      await waitFor(() =>
        expect(sendAutoPmSweep).toHaveBeenCalledWith({ only: { pinned: job.pinnedBranch }, projectId: 'p1' }),
      )
    }
    expect(sendAutoPmSweep).toHaveBeenCalledTimes(pinned.length)
    expect(start).not.toHaveBeenCalled()
  })

  /** Open one row's secondary half — the chevron beside its Run now. */
  const openRunMenu = async (job: AutoPmJob) => {
    await waitFor(() => expect(screen.getAllByText('Run now').length).toBe(AUTO_PM_ROUTINES.length))
    fireEvent.click(screen.getByRole('button', { name: `Other ways to run ${routineName(job)}` }))
    return await screen.findByText('Configure first, then run')
  }

  test('Configure first, then run hands the prompt to the launcher instead of starting it (#1507)', async () => {
    const selected: string[] = []
    renderCard({ onSelectProject: id => selected.push(id) })
    fireEvent.click(await openRunMenu(ROTATION_JOB))
    // The launcher, not an agent: this button exists because Run now spends the agent on a model
    // and a location that are nowhere on this card.
    await waitFor(() => expect(selected).toEqual(['p1']))
    expect(start).not.toHaveBeenCalled()
    expect(sendAutoPmSweep).not.toHaveBeenCalled()
    // Carried through the same stash a hot ticket uses (#1066/#1139), so the launcher rehydrates
    // with this routine's prompt verbatim rather than an empty composer.
    expect(takePendingDraft()).toBe(ROTATION_JOB.prompt)
  })

  test('the prompt goes to the project the card has picked, not the first one (#1507)', async () => {
    onProjects.mockResolvedValue([project('p1', 'gemstack'), project('p2', 'other')])
    // The pick is the setting (#1647); the picker writes it, and the card reads it back.
    prefs = { autoPmProject: 'p2' }
    const selected: string[] = []
    renderCard({ onSelectProject: id => selected.push(id) })
    await waitFor(() => expect(screen.getAllByText('Run now').length).toBe(AUTO_PM_ROUTINES.length))
    fireEvent.click(await openRunMenu(ROTATION_JOB))
    await waitFor(() => expect(selected).toEqual(['p2']))
  })

  // #1647: the pick is a preference. Held as card state it was forgotten whenever the card
  // unmounted — open a run, come back — and the next click landed on the first project, the real
  // repo, which pushed an empty triage branch there.
  test('the picked project is a setting, so it holds across navigations and reloads (#1647)', async () => {
    onProjects.mockResolvedValue([project('p1', 'gemstack'), project('p2', 'other')])
    prefs = { autoPmProject: 'p2' }
    renderCard()
    await waitFor(() => expect(screen.getAllByText('Run now').length).toBe(AUTO_PM_ROUTINES.length))
    // Read back from the setting, not defaulted to the first project.
    expect((screen.getByLabelText('Run in') as HTMLSelectElement).value).toBe('p2')
    // Written as the setting, so a remount reads the same answer.
    fireEvent.change(screen.getByLabelText('Run in'), { target: { value: 'p1' } })
    expect(updatePreferences).toHaveBeenCalledWith({ autoPmProject: 'p1' })
  })

  test('a remembered project that is no longer registered falls back to the first (#1647)', async () => {
    onProjects.mockResolvedValue([project('p1', 'gemstack'), project('p2', 'other')])
    prefs = { autoPmProject: 'gone' }
    renderCard()
    await waitFor(() => expect(screen.getAllByText('Run now').length).toBe(AUTO_PM_ROUTINES.length))
    expect((screen.getByLabelText('Run in') as HTMLSelectElement).value).toBe('p1')
  })

  test("the drain's menu item says it is one agent, not the fan-out its Run now fires (#1507)", async () => {
    renderCard()
    await openRunMenu(AUTO_PM_DRAIN_JOB)
    // The launcher can only ever send one agent, so this row's two halves really do different
    // jobs — and the row says so rather than letting them look alike.
    expect(await screen.findByText(/one agent, not the fan-out/)).toBeTruthy()
  })

  test('a routine whose Run now is a plain start promises the settings, not a caveat (#1507)', async () => {
    renderCard()
    await openRunMenu(ROTATION_JOB)
    expect(await screen.findByText(/set the model and where it runs/)).toBeTruthy()
    expect(screen.queryByText(/one agent, not the fan-out/)).toBeNull()
  })

  test('Configure first stays live while a start is in flight, since it starts nothing (#1507)', async () => {
    busy = true
    const selected: string[] = []
    renderCard({ onSelectProject: id => selected.push(id) })
    await waitFor(() => expect(screen.getAllByText('Run now').length).toBe(AUTO_PM_ROUTINES.length))
    // Run now is out — one start at a time — but going to look at the settings is not a start.
    expect(screen.getAllByText('Run now')[1]!.closest('button')!.disabled).toBe(true)
    fireEvent.click(await openRunMenu(ROTATION_JOB))
    await waitFor(() => expect(selected).toEqual(['p1']))
  })

  test("the drain's Run now fires a drain-only sweep, the only thing that can fan out (#1204)", async () => {
    // Rom's demo click: "Spin up agents working on the AI queue" must spin up to the concurrency,
    // one agent per entry. A plain start could only ever be one agent on the first entry.
    sendAutoPmSweep.mockResolvedValue({ ok: true })
    const started: unknown[][] = []
    renderCard({ onAgentStarted: (...args) => started.push(args) })
    await waitFor(() => expect(screen.getAllByText('Run now').length).toBeGreaterThan(0))
    fireEvent.click(screen.getAllByText('Run now')[0]!)
    // No project id on purpose: the drain sweeps every project the daemon watches, which is what
    // its own tooltip promises — unlike the planning routine's click, which stays in the picked one.
    await waitFor(() => expect(sendAutoPmSweep).toHaveBeenCalledWith({ only: 'drain' }))
    expect(start).not.toHaveBeenCalled()
    // No navigation: the batch lands in the Agents card, not one session's page.
    expect(started).toHaveLength(0)
  })

  test("the drain's Run now on a host with no sweep says so instead of failing silently (#1204)", async () => {
    sendAutoPmSweep.mockResolvedValue({ ok: false })
    renderCard()
    await waitFor(() => expect(screen.getAllByText('Run now').length).toBeGreaterThan(0))
    fireEvent.click(screen.getAllByText('Run now')[0]!)
    await waitFor(() => expect(screen.getByText(/not running the sweep/).textContent).toMatch(/nothing to trigger/))
  })

  test('a start that reports no run id still hands the project over, for the adopt fallback (#1191)', async () => {
    start.mockResolvedValue({ ok: true })
    const started: unknown[][] = []
    renderCard({ onAgentStarted: (...args) => started.push(args) })
    await waitFor(() => expect(screen.getAllByText('Run now').length).toBeGreaterThan(0))
    fireEvent.click(screen.getAllByText('Run now')[1]!)
    await waitFor(() => expect(started).toHaveLength(1))
    expect(started[0]).toEqual(['p1', ROTATION_JOB.prompt, undefined])
  })

  test('a failed start neither navigates nor leaves the button stuck on Starting', async () => {
    start.mockResolvedValue(undefined)
    startError = 'A session is already active for this project.'
    const started: unknown[][] = []
    renderCard({ onAgentStarted: (...args) => started.push(args) })
    await waitFor(() => expect(screen.getAllByText('Run now').length).toBeGreaterThan(0))
    fireEvent.click(screen.getAllByText('Run now')[1]!)
    await waitFor(() => expect(start).toHaveBeenCalled())
    expect(started).toHaveLength(0)
    await waitFor(() => expect(screen.queryByText('Starting…')).toBeNull())
    expect(screen.getByRole('alert').textContent).toMatch(/already active/)
  })

  test('with auto-run on and a reported sweep, the box says when it next runs', async () => {
    prefs = { autoPm: true }
    autoPm = { enabled: true, sweptAt: Date.now(), nextSweepAt: Date.now() + 2 * 60 * 60_000, outcomes: [] }
    renderCard()
    await waitFor(() => expect(screen.getByText('Auto-runs in 2 hr')).toBeTruthy())
  })

  test('with auto-run off, or before the daemon has reported, it says only what it does', async () => {
    prefs = { autoPm: true }
    autoPm = undefined
    const { rerender } = renderCard()
    // On, but no sweep has reported yet: a countdown here would be invented.
    await waitFor(() => expect(screen.getByText('Auto-run')).toBeTruthy())
    prefs = {}
    rerender(<RoutineWork onAgentStarted={() => {}} onSelectProject={() => {}} />)
    expect(screen.getByText('Auto-run')).toBeTruthy()
  })

  test('the checkbox is the one global preference, and carries the tooltip', async () => {
    renderCard()
    await waitFor(() => expect(screen.getByText('Auto-run')).toBeTruthy())
    // One box per routine (#1209), plus the master at the foot.
    expect(screen.getAllByRole('checkbox')).toHaveLength(AUTO_PM_ROUTINES.length + 1)
    fireEvent.click(screen.getByText('Auto-run'))
    expect(updatePreferences).toHaveBeenCalledWith({ autoPm: true })
    const label = screen.getByText('Auto-run').closest('label')!
    expect((await hoverTooltip(label)).textContent).toBe('Automatically run the ticked routines on a regular schedule.')
  })

  test('every routine starts ticked, and unticking one records only that one (#1209)', async () => {
    renderCard()
    await waitFor(() => expect(screen.getAllByText('Run now').length).toBe(AUTO_PM_ROUTINES.length))
    // Nothing saved means nothing opted out: the schedule is whole until it is edited.
    for (const job of AUTO_PM_ROUTINES) expect(routineBox(job).getAttribute('aria-checked')).toBe('true')
    fireEvent.click(screen.getByText(routineName(AUTO_PM_DRAIN_JOB)))
    expect(updatePreferences).toHaveBeenCalledWith({ autoPmOptOut: [AUTO_PM_DRAIN_JOB.name] })
  })

  test('an opted-out routine shows unticked, and re-ticking it drops only it (#1209)', async () => {
    const other = AUTO_PM_ROUTINES[1]!.name
    prefs = { autoPmOptOut: [AUTO_PM_DRAIN_JOB.name, other] }
    renderCard()
    await waitFor(() => expect(screen.getAllByText('Run now').length).toBe(AUTO_PM_ROUTINES.length))
    expect(routineBox(AUTO_PM_DRAIN_JOB).getAttribute('aria-checked')).toBe('false')
    fireEvent.click(screen.getByText(routineName(AUTO_PM_DRAIN_JOB)))
    // The other opt-out survives: the row writes the whole set, so it must not clear its siblings.
    expect(updatePreferences).toHaveBeenCalledWith({ autoPmOptOut: [other] })
  })

  test('Run now ignores the checkbox: it fires the routine once, on demand (#1209)', async () => {
    prefs = { autoPmOptOut: AUTO_PM_ROUTINES.map(job => job.name) }
    renderCard()
    await waitFor(() => expect(screen.getAllByText('Run now').length).toBe(AUTO_PM_ROUTINES.length))
    for (const button of screen.getAllByText('Run now')) expect((button as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(screen.getAllByText('Run now')[1]!)
    await waitFor(() => expect(start).toHaveBeenCalled())
    expect(start.mock.calls[0]![1]).toBe(ROTATION_JOB.prompt)
  })

  test('auto-run on with nothing ticked says so, rather than counting down to nothing (#1209)', async () => {
    prefs = { autoPm: true, autoPmOptOut: AUTO_PM_ROUTINES.map(job => job.name) }
    renderCard()
    await waitFor(() => expect(screen.getByText(/Every routine is unticked/)).toBeTruthy())
    cleanup()
    // One routine back on and the warning goes: the schedule has something to do again.
    prefs = { autoPm: true, autoPmOptOut: AUTO_PM_ROUTINES.slice(1).map(job => job.name) }
    renderCard()
    await waitFor(() => expect(screen.getByText('Auto-run')).toBeTruthy())
    expect(screen.queryByText(/Every routine is unticked/)).toBeNull()
  })

  test('several projects get a picker, and Run now honours it', async () => {
    onProjects.mockResolvedValue([project('p1', 'gemstack'), project('p2', 'rudder')])
    // The picker's pick is the setting (#1647), so this is what a picked card reads.
    prefs = { autoPmProject: 'p2' }
    renderCard()
    expect(((await screen.findByLabelText('Run in')) as HTMLSelectElement).value).toBe('p2')
    fireEvent.click(screen.getAllByText('Run now')[1]!)
    await waitFor(() => expect(start).toHaveBeenCalled())
    expect(start.mock.calls[0]![0]).toBe('p2')
  })

  test('Trigger routine now fires the sweep instead of waiting out the countdown (#1210)', async () => {
    prefs = { autoPm: true }
    renderCard()
    const button = await screen.findByText('Trigger routine now')
    fireEvent.click(button)
    await waitFor(() => expect(sendAutoPmSweep).toHaveBeenCalledTimes(1))
  })

  test('with auto-run off the trigger still sweeps once: the click is the ask (#1210)', async () => {
    prefs = { autoPm: false }
    renderCard()
    const button = (await screen.findByText('Trigger routine now')).closest('button')!
    expect(button.disabled).toBe(false)
    // The tooltip carries the one thing worth saying here: this is a one-shot, not an enrolment.
    expect((await hoverTooltip(button)).textContent).toMatch(/Auto-run stays off/)
    fireEvent.click(button)
    await waitFor(() => expect(sendAutoPmSweep).toHaveBeenCalledTimes(1))
  })

  test('a host with no sweep says so rather than looking like it worked (#1210)', async () => {
    prefs = { autoPm: true }
    sendAutoPmSweep.mockResolvedValue({ ok: false })
    renderCard()
    fireEvent.click(await screen.findByText('Trigger routine now'))
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/not running the sweep/i))
  })

  // #1433: two presses used to show literally nothing — the RPC was fire-and-forget and the
  // card only ever spoke on failure. The sweep's own answer now lands in the note slot.
  test('the triggered sweep says what it decided, plainly for a single project (#1433)', async () => {
    prefs = { autoPm: true }
    sendAutoPmSweep.mockResolvedValue({
      ok: true,
      outcomes: [{ projectId: 'p1', path: '/home/me/repo', started: false, message: 'the queue has work waiting and its routine is switched off' }],
    })
    renderCard()
    fireEvent.click(await screen.findByText('Trigger routine now'))
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe('the queue has work waiting and its routine is switched off'),
    )
  })

  test('several projects each get their line, named by folder (#1433)', async () => {
    prefs = { autoPm: true }
    sendAutoPmSweep.mockResolvedValue({
      ok: true,
      outcomes: [
        { projectId: 'p1', path: '/home/me/alpha', started: true, message: 'started a drain' },
        { projectId: 'p2', path: '/home/me/beta', started: false, message: 'a run is already active' },
      ],
    })
    renderCard()
    fireEvent.click(await screen.findByText('Trigger routine now'))
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/alpha: started a drain/))
    expect(screen.getByRole('status').textContent).toMatch(/beta: a run is already active/)
  })

  test("the drain's Run now reports its sweep's outcome the same way (#1433)", async () => {
    sendAutoPmSweep.mockResolvedValue({
      ok: true,
      outcomes: [{ projectId: 'p1', path: '/home/me/repo', started: false, message: 'the queue is empty, so there is nothing to drain' }],
    })
    renderCard()
    await waitFor(() => expect(screen.getAllByText('Run now').length).toBeGreaterThan(0))
    fireEvent.click(screen.getAllByText('Run now')[0]!)
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe('the queue is empty, so there is nothing to drain'),
    )
  })

  test('one project needs no picker', async () => {
    renderCard()
    await waitFor(() => expect(screen.getAllByText('Run now').length).toBeGreaterThan(0))
    expect(screen.queryByLabelText('Run in')).toBeNull()
  })

  test('with no project there is nothing to run a routine in, and it says so', async () => {
    onProjects.mockResolvedValue([])
    renderCard()
    await waitFor(() => expect(screen.getByText('Add a project to run a routine.')).toBeTruthy())
    expect(screen.queryByText('Run now')).toBeNull()
  })

  // #1204: how many agents the routine keeps going at once.

  test('the concurrent-agents box shows the daemon default until it is set', async () => {
    renderCard()
    const box = (await screen.findByLabelText('Concurrent agents')) as HTMLInputElement
    // The default rather than 1, so the number on screen is the number the sweep would use.
    expect(box.value).toBe(String(DEFAULT_AUTO_PM_CONCURRENCY))
    expect(box.max).toBe(String(MAX_AUTO_PM_CONCURRENCY))
  })

  test('typing a concurrency writes it, clamped to the cap', async () => {
    renderCard()
    const box = await screen.findByLabelText('Concurrent agents')
    fireEvent.change(box, { target: { value: '5' } })
    expect(updatePreferences).toHaveBeenCalledWith({ autoPmConcurrency: 5 })
    // The store clamps too, but a number input still hands back whatever was typed into it.
    fireEvent.change(box, { target: { value: '999' } })
    expect(updatePreferences).toHaveBeenCalledWith({ autoPmConcurrency: MAX_AUTO_PM_CONCURRENCY })
    fireEvent.change(box, { target: { value: '0' } })
    expect(updatePreferences).toHaveBeenCalledWith({ autoPmConcurrency: 1 })
    // An emptied box is not a preference: it must not write NaN into the home file.
    updatePreferences.mockClear()
    fireEvent.change(box, { target: { value: '' } })
    expect(updatePreferences).not.toHaveBeenCalled()
  })

  test('the fine print follows the setting rather than promising an idle machine', async () => {
    prefs = { autoPmConcurrency: 4 }
    renderCard()
    await waitFor(() => expect(screen.getByText(/Keeps up to 4 agents going at once/)).toBeTruthy())
  })

  test('a start already in flight disables every Run now', async () => {
    busy = true
    renderCard()
    await waitFor(() => expect(screen.getAllByText('Run now').length).toBeGreaterThan(0))
    for (const button of screen.getAllByText('Run now')) expect((button as HTMLButtonElement).disabled).toBe(true)
  })
})
