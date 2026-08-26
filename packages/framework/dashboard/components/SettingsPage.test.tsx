import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { refreshPreferences } from '../lib/preferences.js'

// The reads this page makes, answered as an empty machine: no devices, no editors detected, no
// stored preferences. The rest of the module is kept, since the onboarding checklist inside the
// page reads far more than the settings rows do.
const checkDevices = vi.hoisted(() => vi.fn(async () => ({})))
const prefsRead = vi.hoisted(() => vi.fn(async (): Promise<Record<string, unknown>> => ({})))
vi.mock('../rpc/preferences.js', async importOriginal => ({
  ...(await importOriginal<typeof import('../rpc/preferences.js')>()),
  onPreferences: prefsRead,
}))
vi.mock('../rpc/devices.js', () => ({ checkDevices }))
vi.mock('../rpc/reads.js', async importOriginal => ({
  ...(await importOriginal<typeof import('../rpc/reads.js')>()),
  onBridgeToken: vi.fn(async () => null),
  onBridgeBrowser: vi.fn(async () => ({ state: 'off' as const })),
  onNotifyChannels: vi.fn(async () => ({})),
  onPreferences: vi.fn(async () => ({})),
  onDetectedEditors: vi.fn(async () => []),
  onDashboard: vi.fn(async () => null),
  onOnboardingSuggestion: vi.fn(async () => null),
}))

import { SettingsPage } from './SettingsPage.js'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('SettingsPage dropdowns (#1172)', () => {
  test('no dropdown renders with nothing in it', () => {
    // The reported paper cut was an empty dropdown at the bottom of this page: a control you can
    // open and not use, which reads as broken rather than as "no choices here". The control itself
    // did not survive the deletions on this branch, so this asserts the property rather than
    // hunting the instance — the next dynamic option list is the one that would bring it back.
    const { container } = render(<SettingsPage onAgentStarted={() => {}} onSelectProject={() => {}} />)
    const selects = [...container.querySelectorAll('select')]
    expect(selects.length).toBeGreaterThan(0) // the page really did render its controls
    for (const select of selects) {
      expect(select.querySelectorAll('option').length).toBeGreaterThan(0)
    }
  })

  test('an editor list the daemon could not fill still leaves a usable Editor row', () => {
    // Its options are the one list on the page assembled at run time. Auto-detect is a real
    // choice rather than a placeholder, so the row stays operable with nothing detected.
    render(<SettingsPage onAgentStarted={() => {}} onSelectProject={() => {}} />)
    const editor = screen.getByLabelText('Editor') as HTMLSelectElement
    expect([...editor.querySelectorAll('option')].map(o => o.textContent)).toEqual(['Auto-detect'])
  })
})

describe('SettingsPage Claude web (#1332)', () => {
  test('with the bridge on, which browser does the work is one choice, and each option carries its own setup', async () => {
    // "Browser bridge" and "Bridge browser" as two toggles read as anagrams of each other; the
    // real decision is which browser drives claude.ai, so it is presented as exactly that.
    prefsRead.mockResolvedValueOnce({ bridge: true, bridgeBrowser: true })
    refreshPreferences()
    render(<SettingsPage onAgentStarted={() => {}} onSelectProject={() => {}} />)
    const daemon = (await screen.findByLabelText(/A browser the daemon runs/)) as HTMLInputElement
    const own = screen.getByLabelText('Your own Chrome') as HTMLInputElement
    expect(daemon.type).toBe('radio')
    expect(daemon.checked).toBe(true)
    expect(own.checked).toBe(false)
    // The daemon's browser carries its status; the token to paste belongs to the other option only.
    await waitFor(() => expect(screen.getByText(/The bridge browser is off/)).toBeTruthy())
    expect(screen.queryByText(/paste this token/)).toBeNull()
  })

  test('with the bridge off there is no browser to choose', async () => {
    prefsRead.mockResolvedValueOnce({ bridge: false })
    refreshPreferences()
    render(<SettingsPage onAgentStarted={() => {}} onSelectProject={() => {}} />)
    await screen.findByLabelText('Browser bridge')
    expect(screen.queryByText(/Which browser does the work/)).toBeNull()
  })
})
