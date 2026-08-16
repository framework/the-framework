import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Preferences } from '../../dist/index.js'
import type { NotifyChannels } from '../rpc/preferences.js'

// The Discord setup dialogs (#1095). What is worth pinning is the credential contract, not the
// copy: a credential goes in and never comes back, an env-set one is reported rather than edited,
// and what is stored is offered as Replace/Remove rather than a field with a secret in it.

// Typed as the RPC's own result union, not inferred from the happy-path default, so a test can
// set the refusal case.
const saveDiscordCredentials = vi.hoisted(() =>
  vi.fn<(patch: unknown) => Promise<{ ok: true } | { ok: false; error: string }>>(async () => ({ ok: true })),
)
vi.mock('../rpc/preferences.js', () => ({ saveDiscordCredentials }))

const updatePreferences = vi.hoisted(() => vi.fn())
let prefs: Preferences = {}
vi.mock('../lib/preferences.js', () => ({
  usePreferences: () => prefs,
  updatePreferences,
  discordEnabled: (p: Preferences) => p.notifyDiscord ?? false,
}))

const { DiscordWebhookDialog } = await import('./DiscordDialogs.js')

/** A channels payload: nothing configured unless a test says otherwise, and storable. */
const channels = (sources: NotifyChannels['sources'] = {}, editable = true): NotifyChannels => ({
  discordWebhook: sources.webhook !== undefined,
  sources,
  editable,
})

const onSaved = vi.fn()

beforeEach(() => {
  prefs = {}
  saveDiscordCredentials.mockReset()
  saveDiscordCredentials.mockResolvedValue({ ok: true })
  updatePreferences.mockReset()
  onSaved.mockReset()
})
afterEach(cleanup)

const field = (label: RegExp) => screen.getByLabelText(label) as HTMLInputElement

describe('DiscordWebhookDialog (#1095)', () => {
  test('saving a webhook URL sends it under its own key, leaving the bot token alone', async () => {
    render(<DiscordWebhookDialog open onOpenChange={() => {}} channels={channels()} onSaved={onSaved} />)

    fireEvent.change(field(/webhook url/i), { target: { value: 'https://discord.com/api/webhooks/1/abc' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(saveDiscordCredentials).toHaveBeenCalledWith({ webhook: 'https://discord.com/api/webhooks/1/abc' }),
    )
  })

  test('a URL that is not one is refused before the round trip', () => {
    render(<DiscordWebhookDialog open onOpenChange={() => {}} channels={channels()} onSaved={onSaved} />)

    fireEvent.change(field(/webhook url/i), { target: { value: 'not a url' } })
    expect(screen.getByText(/not a URL/i)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true)
  })

  test('its toggle is Discord delivery, not the bot', () => {
    render(<DiscordWebhookDialog open onOpenChange={() => {}} channels={channels()} onSaved={onSaved} />)

    fireEvent.click(screen.getByRole('button', { name: 'Enable' }))
    expect(updatePreferences).toHaveBeenCalledWith({ notifyDiscord: true })
  })
})
