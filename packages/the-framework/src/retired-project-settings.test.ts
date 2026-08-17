import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { registryPath, type RegistryFs } from './registry.js'
import {
  captureRetiredProjectSettings,
  readRetiredProjectSettings,
  retiredProjectAdvice,
  retiredProjectSettings,
  retiredProjectSettingsNotice,
} from './retired-project-settings.js'

const ENV = { HOME: '/home/u' }
const FILE = registryPath(ENV)

/** A read-only registry fs: this module never writes, and a write here would be the bug. */
function memFs(seed: Record<string, string> = {}): RegistryFs {
  const files = new Map(Object.entries(seed))
  return {
    async read(path) {
      const value = files.get(path)
      if (value === undefined) throw new Error(`ENOENT: ${path}`)
      return value
    },
    async write() {
      throw new Error('the notice must never write')
    },
    async mkdir() {},
  }
}

const APP_A = { id: 'app-a-1', path: '/repos/app-a', addedAt: '2026-07-10T09:00:00.000Z' }
const APP_B = { id: 'app-b-2', path: '/repos/app-b', addedAt: '2026-07-10T10:00:00.000Z' }

const stored = (projectPreferences: Record<string, unknown>, projects = [APP_A, APP_B]) =>
  memFs({ [FILE]: JSON.stringify({ projects, preferences: {}, projectPreferences }) })

test('a project that had settings is named by its path, with the keys it held', async () => {
  const fs = stored({ [APP_A.id]: { handoff: 'local', model: 'opus' } })
  assert.deepEqual(await readRetiredProjectSettings(fs, ENV), [
    { path: '/repos/app-a', keys: ['handoff', 'model'], publishes: true, handoff: 'local' },
  ])
})

test('the rung is carried only when the block set one, since it is the half with a replacement', async () => {
  // `model` and the rest have no home in the committed yml, so there is no line to print for them.
  const fs = stored({ [APP_A.id]: { model: 'opus' }, [APP_B.id]: { handoff: 'merge' } })
  const retired = await readRetiredProjectSettings(fs, ENV)
  assert.equal(retired.find(p => p.path === '/repos/app-a')?.handoff, undefined)
  assert.equal(retired.find(p => p.path === '/repos/app-b')?.handoff, 'merge')
})

test('a rung the ladder does not have is not reported as one — but it still counts as publishing', async () => {
  // The block is whatever is on disk. A pre-ladder block spells publishing as the three booleans
  // B5 replaced, and turning those back into a rung needs the mapping this branch deleted — so the
  // row says publishing was set here without claiming to know which rung, rather than reassuring
  // the reader about the one repo whose setting mattered most.
  const fs = stored({ [APP_A.id]: { autoPushBranch: false, autoOpenPr: false } })
  assert.deepEqual(await readRetiredProjectSettings(fs, ENV), [
    { path: '/repos/app-a', keys: ['autoPushBranch', 'autoOpenPr'], publishes: true },
  ])
  assert.match(retiredProjectAdvice((await readRetiredProjectSettings(fs, ENV))[0]!), /local \| push \| pr \| merge/)
})

test('the advice warns for a block that set publishing and reassures only for one that did not', () => {
  const advice = (project: Parameters<typeof retiredProjectAdvice>[0]) => retiredProjectAdvice(project)
  assert.match(
    advice({ path: '/repos/app-a', keys: ['handoff'], publishes: true, handoff: 'local' }),
    /Add `handoff: local`.*push their branch and open a pull request/,
  )
  assert.equal(
    advice({ path: '/repos/app-b', keys: ['model'], publishes: false }),
    'Your own settings apply to it now.',
  )
})

test('a project since removed from the registry is still named, by its id', async () => {
  // The point is that nothing stopped applying silently; dropping the row because the project is
  // gone would be the silence this exists to break.
  const fs = stored({ 'ghost-9': { handoff: 'local' } }, [APP_A])
  assert.deepEqual((await readRetiredProjectSettings(fs, ENV)).map(p => p.path), ['ghost-9'])
})

test('an empty block, a missing file, a malformed one and a junk shape are all nothing', async () => {
  assert.deepEqual(await readRetiredProjectSettings(stored({ [APP_A.id]: {} }), ENV), [])
  assert.deepEqual(await readRetiredProjectSettings(memFs(), ENV), [])
  assert.deepEqual(await readRetiredProjectSettings(memFs({ [FILE]: '{ not json' }), ENV), [])
  assert.deepEqual(await readRetiredProjectSettings(memFs({ [FILE]: '[]' }), ENV), [])
  assert.deepEqual(
    await readRetiredProjectSettings(memFs({ [FILE]: JSON.stringify({ projectPreferences: 'nope' }) }), ENV),
    [],
  )
})

test('the file with no retired block at all — everyone, after one write — is nothing', async () => {
  const fs = memFs({ [FILE]: JSON.stringify({ projects: [APP_A], preferences: { handoff: 'local' } }) })
  assert.deepEqual(await readRetiredProjectSettings(fs, ENV), [])
})

test('the boot capture is what the dashboard is served, and it survives the block being erased', async () => {
  // The daemon reads once, before its own first write rewrites the file without the block. Anything
  // reading the file later would find nothing, which is why the RPC reads this snapshot instead.
  await captureRetiredProjectSettings(stored({ [APP_A.id]: { handoff: 'local' } }), ENV)
  assert.deepEqual(retiredProjectSettings(), [
    { path: '/repos/app-a', keys: ['handoff'], publishes: true, handoff: 'local' },
  ])

  const erased = memFs({ [FILE]: JSON.stringify({ projects: [APP_A], preferences: {} }) })
  assert.deepEqual(await readRetiredProjectSettings(erased, ENV), [], 'the file no longer has it')
  assert.equal(retiredProjectSettings().length, 1, 'the snapshot still does')

  await captureRetiredProjectSettings(erased, ENV) // leave the module as the next test finds it
  assert.deepEqual(retiredProjectSettings(), [])
})

test('the log notice names each repo, what it held, and the same advice the banner shows', () => {
  const lines = retiredProjectSettingsNotice([
    { path: '/repos/app-a', keys: ['handoff'], publishes: true, handoff: 'local' },
    { path: '/repos/app-b', keys: ['model', 'target'], publishes: false },
  ])
  assert.equal(lines.length, 3)
  assert.match(lines[0]!, /per-project settings are no longer read/)
  assert.match(lines[1]!, /\/repos\/app-a had handoff\. Add `handoff: local`/)
  assert.match(lines[2]!, /\/repos\/app-b had model, target\. Your own settings apply/)
})

test('nothing retired prints nothing — not a heading over an empty list', () => {
  assert.deepEqual(retiredProjectSettingsNotice([]), [])
})
