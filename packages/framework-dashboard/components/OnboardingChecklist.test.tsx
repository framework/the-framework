import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { DashboardData } from '@gemstack/the-framework'

// The checklist reads its state over several telefunc shims and hooks; stub them all so the import
// graph stays out of telefunc and each row's "done" comes from a fixture rather than a real daemon.
const onDashboard = vi.hoisted(() => vi.fn())
const onOnboarding = vi.hoisted(() => vi.fn())
vi.mock('../server/reads.telefunc.js', () => ({ onDashboard }))
vi.mock('../server/projects.telefunc.js', () => ({ onOnboarding, sendAddProject: vi.fn() }))
vi.mock('../server/preferences.telefunc.js', () => ({ saveDiscordCredentials: vi.fn() }))
vi.mock('../lib/preferences.js', () => ({
  usePreferences: () => ({}),
  updatePreferences: vi.fn(),
  notificationsEnabled: () => false,
  discordBotEnabled: () => false,
  discordEnabled: () => false,
}))
vi.mock('../lib/notify-channels.js', () => ({ useNotifyChannels: () => null, reloadNotifyChannels: vi.fn() }))
vi.mock('../lib/notification-permission.js', () => ({ useNotificationPermission: () => 'default' }))
// One stable object, so a test can steer the start and its error without a re-mock.
const startRun = vi.hoisted(() => ({ start: vi.fn(), busy: false, error: null as string | null }))
vi.mock('../lib/use-start-run.js', () => ({ useStartRun: () => startRun }))

const { OnboardingChecklist } = await import('./OnboardingChecklist.js')

afterEach(() => {
  cleanup()
  startRun.start.mockReset()
  startRun.busy = false
  startRun.error = null
})

/** A board with nothing set up: every row is open, which is when the marks have to be readable. */
const EMPTY: DashboardData = {
  totals: { projects: 0, activeRuns: 0, openTodos: 0, totalRuns: 0 },
  projects: [],
  active: [],
  queue: [],
  activity: [],
  runsByStatus: {},
} as unknown as DashboardData

/** One project registered, no tickets in it: the state the import step is offered in. */
const WITH_PROJECT: DashboardData = {
  ...EMPTY,
  totals: { projects: 1, activeRuns: 0, openTodos: 0, totalRuns: 0 },
  projects: [{ projectId: 'p1', hasTickets: false }],
} as unknown as DashboardData

/** Click the import step and wait for the start to have been attempted. */
const clickImport = async () => {
  fireEvent.click(await screen.findByRole('button', { name: /import tickets from github/i }))
  await waitFor(() => expect(startRun.start).toHaveBeenCalled())
}

describe('OnboardingChecklist (#1139)', () => {
  test('the steps nothing breaks without are marked optional, and the two essentials are not', async () => {
    onDashboard.mockResolvedValue(EMPTY)
    onOnboarding.mockResolvedValue(null)
    render(<OnboardingChecklist onRunStarted={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('Add a project')).toBeTruthy())

    // Four integrations/inputs are optional; adding a project and filling the queue are not.
    expect(screen.getAllByText('Optional')).toHaveLength(4)
    const marked = (label: string) => screen.getByText(label).querySelector('span')?.textContent === 'Optional'
    expect(marked('Add a project')).toBe(false)
    expect(marked('Populate the queue of AI tasks')).toBe(false)
    expect(marked('Populate tickets/')).toBe(true)
    expect(marked('Add the Discord bot')).toBe(true)
  })

  test('an unticked step is a checkbox, not a radio button', async () => {
    onDashboard.mockResolvedValue(EMPTY)
    onOnboarding.mockResolvedValue(null)
    const { container } = render(<OnboardingChecklist onRunStarted={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('Add a project')).toBeTruthy())
    // An outlined circle read as "pick one of these" when the rows are independent things to tick.
    expect(container.querySelector('circle')).toBeNull()
    expect(screen.getAllByLabelText('Not done').length).toBeGreaterThan(0)
  })
})

describe('the GitHub import lands on the session it starts (#1169)', () => {
  test('the started run id is handed up, with the project it runs in', async () => {
    onDashboard.mockResolvedValue(WITH_PROJECT)
    onOnboarding.mockResolvedValue(null)
    startRun.start.mockResolvedValue({ runId: 'run-7' })
    const onRunStarted = vi.fn()
    render(<OnboardingChecklist onRunStarted={onRunStarted} />)
    await clickImport()

    // The project travels with it: this surface has none selected, so an id alone cannot be routed.
    expect(startRun.start).toHaveBeenCalledWith('p1', 'Import tickets from GitHub', 'prompt', {})
    await waitFor(() => expect(onRunStarted).toHaveBeenCalledWith('p1', 'Import tickets from GitHub', 'run-7'))
  })

  test('a project with no worktree hands up no id, so the shell can adopt the running one', async () => {
    onDashboard.mockResolvedValue(WITH_PROJECT)
    onOnboarding.mockResolvedValue(null)
    startRun.start.mockResolvedValue({})
    const onRunStarted = vi.fn()
    render(<OnboardingChecklist onRunStarted={onRunStarted} />)
    await clickImport()

    await waitFor(() => expect(onRunStarted).toHaveBeenCalledWith('p1', 'Import tickets from GitHub', undefined))
  })

  test('a refused start says why and moves you nowhere', async () => {
    onDashboard.mockResolvedValue(WITH_PROJECT)
    onOnboarding.mockResolvedValue(null)
    startRun.start.mockResolvedValue(undefined)
    startRun.error = 'A session is already active for this project.'
    const onRunStarted = vi.fn()
    render(<OnboardingChecklist onRunStarted={onRunStarted} />)
    await clickImport()

    expect(await screen.findByText(/already active/i)).toBeTruthy()
    expect(onRunStarted).not.toHaveBeenCalled()
  })
})
