import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { provideTelefuncContext } from 'telefunc'
import { savePreferences, patchPreferences, patchProjectPreferences } from './preferences.telefunc.js'
import type { PreferencesStore } from '../registry.js'

/** A store whose every method works, with only the ones a test cares about overridden. */
function store(over: Partial<PreferencesStore> = {}): PreferencesStore {
  return {
    read: async () => ({}),
    save: async () => {},
    patch: async patch => patch,
    readProject: async () => ({}),
    saveProject: async () => {},
    patchProject: async (_projectId, patch) => patch,
    ...over,
  }
}

// One dashboard host wires the store on every request (D3), so there is no not-enabled case left
// to degrade to. What is still worth asserting is a store whose write *fails*: that reports the
// typed error rather than rejecting the RPC, so the client renders it instead of losing the save.

test('savePreferences returns the typed error when the store write fails, not a rejection', async () => {
  provideTelefuncContext({
    preferences: store({
      save: async () => {
        throw new Error('disk full')
      },
    }),
  })
  const result = await savePreferences({ vanilla: true })
  assert.deepEqual(result, { ok: false, error: 'failed to save preferences' })
})

test('patchPreferences hands back what the store merged (#1148)', async () => {
  provideTelefuncContext({
    preferences: store({
      patch: async patch => ({ theme: 'dark', ...patch }),
      patchProject: async (_projectId, patch) => ({ model: 'sonnet', ...patch }),
    }),
  })

  // The merged result is the point: the caller adopts it, which is how a stale tab converges.
  assert.deepEqual(await patchPreferences({ agent: 'codex' }), {
    ok: true,
    preferences: { theme: 'dark', agent: 'codex' },
  })
  assert.deepEqual(await patchProjectPreferences('app-1', { vanilla: true }), {
    ok: true,
    preferences: { model: 'sonnet', vanilla: true },
  })
})

test('patchPreferences returns the typed error when the merge write fails (#1148)', async () => {
  provideTelefuncContext({
    preferences: store({
      patch: async () => {
        throw new Error('disk full')
      },
      patchProject: async () => {
        throw new Error('disk full')
      },
    }),
  })
  const failed = { ok: false, error: 'failed to save preferences' }
  assert.deepEqual(await patchPreferences({ theme: 'dark' }), failed)
  assert.deepEqual(await patchProjectPreferences('app-1', { model: 'opus' }), failed)
})
