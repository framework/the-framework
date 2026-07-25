import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { provideTelefuncContext } from 'telefunc'
import { onPreferences, savePreferences, patchPreferences, patchProjectPreferences } from './preferences.telefunc.js'
import type { PreferencesStore } from '../registry.js'

// Outside a Telefunc `serve({ context })` there is no preferences store on the context — the
// same situation as the public relay, which never wires one. The RPCs must degrade safely: a
// read falls back to the empty default, and a write reports it is not enabled rather than
// touching the host's home file.

test('onPreferences with no store returns the empty default', async () => {
  assert.deepEqual(await onPreferences(), {})
})

test('savePreferences with no store is a not-enabled no-op', async () => {
  const result = await savePreferences({ autopilot: false })
  assert.deepEqual(result, { ok: false, error: 'preferences are not enabled on this server' })
})

test('savePreferences returns the typed error when the store write fails, not a rejection', async () => {
  const store: PreferencesStore = {
    read: async () => ({}),
    save: async () => {
      throw new Error('disk full')
    },
  }
  provideTelefuncContext({ preferences: store })
  const result = await savePreferences({ autopilot: true })
  assert.deepEqual(result, { ok: false, error: 'failed to save preferences' })
})

test('patchPreferences hands back what the store merged (#1148)', async () => {
  const store: PreferencesStore = {
    read: async () => ({}),
    save: async () => {},
    patch: async patch => ({ theme: 'dark', ...patch }),
    patchProject: async (_projectId, patch) => ({ model: 'sonnet', ...patch }),
  }
  provideTelefuncContext({ preferences: store })

  // The merged result is the point: the caller adopts it, which is how a stale tab converges.
  assert.deepEqual(await patchPreferences({ agent: 'codex' }), {
    ok: true,
    preferences: { theme: 'dark', agent: 'codex' },
  })
  assert.deepEqual(await patchProjectPreferences('app-1', { technical: true }), {
    ok: true,
    preferences: { model: 'sonnet', technical: true },
  })
})

test('a store without the patch pair reports not-enabled rather than throwing (#1148)', async () => {
  // Both are optional on the seam, so a host that predates them (or the relay) must degrade the
  // same way the save pair does.
  provideTelefuncContext({ preferences: { read: async () => ({}), save: async () => {} } as PreferencesStore })
  const notEnabled = { ok: false, error: 'preferences are not enabled on this server' }
  assert.deepEqual(await patchPreferences({ theme: 'dark' }), notEnabled)
  assert.deepEqual(await patchProjectPreferences('app-1', { model: 'opus' }), notEnabled)
})

test('patchPreferences returns the typed error when the merge write fails (#1148)', async () => {
  const store: PreferencesStore = {
    read: async () => ({}),
    save: async () => {},
    patch: async () => {
      throw new Error('disk full')
    },
    patchProject: async () => {
      throw new Error('disk full')
    },
  }
  provideTelefuncContext({ preferences: store })
  const failed = { ok: false, error: 'failed to save preferences' }
  assert.deepEqual(await patchPreferences({ theme: 'dark' }), failed)
  assert.deepEqual(await patchProjectPreferences('app-1', { model: 'opus' }), failed)
})
