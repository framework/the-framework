import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { Preferences } from '../../src/index.js'
import { hoverTooltip } from '../test-utils.js'

const updatePreferences = vi.hoisted(() => vi.fn())
let prefs: Preferences = {}
vi.mock('../lib/preferences.js', () => ({
  usePreferences: () => prefs,
  updatePreferences,
  notificationsEnabled: (p: Preferences) => p.notifyBrowser ?? true,
  newActivityEnabled: (p: Preferences) => p.notifyNewActivity ?? false,
  humanInterventionEnabled: (p: Preferences) => p.notifyHumanIntervention ?? true,
}))

const { NotificationsMenu } = await import('./NotificationsMenu.js')

beforeEach(() => {
  prefs = {}
  updatePreferences.mockReset()
  vi.stubGlobal('Notification', { permission: 'granted', requestPermission: vi.fn() })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const bell = () => screen.getByRole('button', { name: /notifications/i })
const open = () => fireEvent.click(bell())
/** What the bell says on hover — the state read-out lives in its tooltip now (#1149). */
const bellTooltip = async () => (await hoverTooltip(bell())).textContent

describe('NotificationsMenu (#676)', () => {
  test('the popover groups the method and the categories, both "Human Queue" and "New activity" toggleable', () => {
    render(<NotificationsMenu />)
    open()
    expect(screen.getByText('Deliver to')).toBeTruthy()
    expect(screen.getByText('Browser')).toBeTruthy()
    expect(screen.getByText('Notify me about')).toBeTruthy()
    expect(screen.getByText('Human Queue')).toBeTruthy()
    expect(screen.queryByText('Always on')).toBeNull() // #627: now a real toggle, no static row
    expect(screen.getByText('New activity')).toBeTruthy()
  })

  test('toggling New activity and Human Queue writes each preference through', () => {
    render(<NotificationsMenu />)
    open()
    fireEvent.click(screen.getByText('New activity'))
    expect(updatePreferences).toHaveBeenCalledWith({ notifyNewActivity: true })
    // Defaults on, so the click turns it OFF (#627).
    fireEvent.click(screen.getByText('Human Queue'))
    expect(updatePreferences).toHaveBeenCalledWith({ notifyHumanIntervention: false })
  })

  test('enabling Browser asks for permission when it has not been granted yet', () => {
    prefs = { notifyBrowser: false }
    vi.stubGlobal('Notification', { permission: 'default', requestPermission: vi.fn() })
    render(<NotificationsMenu />)
    open()
    fireEvent.click(screen.getByText('Browser'))
    expect(updatePreferences).toHaveBeenCalledWith({ notifyBrowser: true })
    expect((globalThis.Notification as unknown as { requestPermission: () => void }).requestPermission).toHaveBeenCalled()
  })

  test('the bell reads active when Browser is on and granted, idle otherwise', async () => {
    const { rerender } = render(<NotificationsMenu />) // default: browser on + granted
    expect(await bellTooltip()).toBe('Notifications on')
    prefs = { notifyBrowser: false }
    rerender(<NotificationsMenu />)
    expect(await bellTooltip()).toBe('Notifications')
  })

  test('a blocked browser permission disables the Browser toggle with a hint', () => {
    vi.stubGlobal('Notification', { permission: 'denied', requestPermission: vi.fn() })
    render(<NotificationsMenu />)
    open()
    expect(screen.getByText('Blocked in your browser settings')).toBeTruthy()
  })

  test('Browser on but not yet granted leaves the bell idle', async () => {
    vi.stubGlobal('Notification', { permission: 'default', requestPermission: vi.fn() })
    render(<NotificationsMenu />)
    expect(await bellTooltip()).toBe('Notifications')
  })

  test('with no browser notification support the menu offers only the categories', () => {
    vi.stubGlobal('Notification', undefined)
    render(<NotificationsMenu />)
    open()
    expect(screen.queryByText('Deliver to')).toBeNull()
    expect(screen.getByText('Human Queue')).toBeTruthy()
  })
})
