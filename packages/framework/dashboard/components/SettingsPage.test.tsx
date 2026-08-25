import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

// The reads this page makes, answered as an empty machine: no devices, no editors detected, no
// stored preferences. The rest of the module is kept, since the onboarding checklist inside the
// page reads far more than the settings rows do.
const checkDevices = vi.hoisted(() => vi.fn(async () => ({})))
vi.mock('../rpc/devices.js', () => ({ checkDevices }))
vi.mock('../rpc/reads.js', async importOriginal => ({
  ...(await importOriginal<typeof import('../rpc/reads.js')>()),
  onBridgeToken: vi.fn(async () => null),
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
