import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
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
vi.mock('../lib/use-start-run.js', () => ({ useStartRun: () => ({ start: vi.fn(), busy: false, error: null }) }))

const { OnboardingChecklist } = await import('./OnboardingChecklist.js')

afterEach(cleanup)

/** A board with nothing set up: every row is open, which is when the marks have to be readable. */
const EMPTY: DashboardData = {
  totals: { projects: 0, activeRuns: 0, openTodos: 0, totalRuns: 0 },
  projects: [],
  active: [],
  queue: [],
  activity: [],
  runsByStatus: {},
} as unknown as DashboardData

describe('OnboardingChecklist (#1139)', () => {
  test('the steps nothing breaks without are marked optional, and the two essentials are not', async () => {
    onDashboard.mockResolvedValue(EMPTY)
    onOnboarding.mockResolvedValue(null)
    render(<OnboardingChecklist />)
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
    const { container } = render(<OnboardingChecklist />)
    await waitFor(() => expect(screen.getByText('Add a project')).toBeTruthy())
    // An outlined circle read as "pick one of these" when the rows are independent things to tick.
    expect(container.querySelector('circle')).toBeNull()
    expect(screen.getAllByLabelText('Not done').length).toBeGreaterThan(0)
  })
})
