import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { join } from 'node:path'
import {
  addProject,
  ensureDaemonToken,
  listProjects,
  projectId,
  readDaemonToken,
  readPreferences,
  readRegistry,
  registryPreferencesStore,
  registryPath,
  removeProject,
  writePreferences,
  patchPreferences,
  readSecrets,
  writeSecrets,
  REGISTRY_FILE,
  REGISTRY_FILE_MODE,
  MAX_SPEND_OFFSET,
  MAX_AUTO_PM_CONCURRENCY,
  type Preferences,
  type ProjectRecord,
  type RegistryFs,
} from './registry.js'

/**
 * An in-memory {@link RegistryFs} so the registry logic is tested without touching disk.
 *
 * `write` truncates before it stores, as a real `writeFile` does. That is what makes the
 * atomicity of #991 observable: `failWritesTo` models a crash or a full disk between the
 * truncate and the flush, leaving the file it truncated empty.
 */
function memFs(
  seed: Record<string, string> = {},
  options: { failWritesTo?: string; slow?: boolean } = {},
): RegistryFs & { files: Map<string, string>; dirs: string[]; written: string[]; modes: Map<string, number> } {
  const files = new Map<string, string>(Object.entries(seed))
  const dirs: string[] = []
  const written: string[] = []
  // Permission bits, so the owner-only write (#1095) is observable without a real filesystem.
  const modes = new Map<string, number>()
  // An await point inside read and write, so concurrent callers interleave rather than each
  // running start to finish.
  const pause = async () => {
    if (options.slow) await new Promise(resolve => setTimeout(resolve, 1))
  }
  return {
    files,
    dirs,
    written,
    modes,
    async read(path) {
      await pause()
      const v = files.get(path)
      if (v === undefined) throw new Error(`ENOENT: ${path}`)
      return v
    },
    async write(path, contents) {
      written.push(path)
      files.set(path, '') // truncate, as `writeFile` does
      await pause()
      if (options.failWritesTo === path) throw new Error(`ENOSPC: ${path}`)
      files.set(path, contents)
    },
    async mkdir(path) {
      dirs.push(path) // no-op: the memory fs has no directories
    },
    async rename(from, to) {
      const contents = files.get(from)
      if (contents === undefined) throw new Error(`ENOENT: ${from}`)
      files.delete(from)
      files.set(to, contents)
      const mode = modes.get(from)
      modes.delete(from)
      if (mode !== undefined) modes.set(to, mode)
    },
    async chmod(path, mode) {
      if (!files.has(path)) throw new Error(`ENOENT: ${path}`)
      modes.set(path, mode)
    },
  }
}

const ENV = { HOME: '/home/u' }
const FILE = registryPath(ENV)

const APP_A: ProjectRecord = {
  id: projectId('/repos/app-a'),
  path: '/repos/app-a',
  addedAt: '2026-07-10T09:00:00.000Z',
}

const APP_B: ProjectRecord = {
  id: projectId('/repos/app-b'),
  path: '/repos/app-b',
  addedAt: '2026-07-10T10:00:00.000Z',
}

test('registryPath prefers XDG_CONFIG_HOME over HOME', () => {
  assert.equal(registryPath({ XDG_CONFIG_HOME: '/cfg' }), join('/cfg', REGISTRY_FILE))
  assert.equal(registryPath({ XDG_CONFIG_HOME: '/cfg', HOME: '/home/u' }), join('/cfg', REGISTRY_FILE))
})

test('registryPath falls back to a single dotfile under HOME (empty XDG counts as unset)', () => {
  assert.equal(registryPath(ENV), join('/home/u', '.' + REGISTRY_FILE))
  assert.equal(registryPath({ XDG_CONFIG_HOME: '', HOME: '/home/u' }), join('/home/u', '.' + REGISTRY_FILE))
})

test('projectId is deterministic and distinct per path', () => {
  assert.equal(projectId('/repos/app-a'), projectId('/repos/app-a'))
  assert.notEqual(projectId('/repos/app-a'), projectId('/repos/app-b'))
  assert.notEqual(projectId('/repos/app-a'), projectId('/other/app-a')) // same basename, different path
})

test('projectId is URL-safe, even for a messy basename', () => {
  for (const path of ['/repos/app-a', '/repos/My App (v2)!', '/repos/ÜMLAUT.dir']) {
    assert.match(projectId(path), /^[a-z0-9-]+$/)
  }
})

test('listProjects on a missing file is []', async () => {
  assert.deepEqual(await listProjects(memFs(), ENV), [])
})

test('listProjects on an empty / malformed / non-array file is []', async () => {
  for (const raw of ['', 'not json', '{"id":"x"}', '42']) {
    assert.deepEqual(await listProjects(memFs({ [FILE]: raw }), ENV), [])
  }
})

test('listProjects round-trips a well-formed file and drops malformed records', async () => {
  const raw = JSON.stringify([APP_A, { id: 'no-path' }, 'nope', APP_B])
  assert.deepEqual(await listProjects(memFs({ [FILE]: raw }), ENV), [APP_A, APP_B])
})

test('listProjects dedupes by resolved path, first wins', async () => {
  const dupe = { ...APP_B, path: '/repos/app-a/', addedAt: '2026-07-10T11:00:00.000Z' }
  const raw = JSON.stringify([APP_A, dupe, APP_B])
  assert.deepEqual(await listProjects(memFs({ [FILE]: raw }), ENV), [APP_A, APP_B])
})

test('addProject appends a record and writes pretty JSON that parses back', async () => {
  const fs = memFs()
  const record = await addProject('/repos/app-a', APP_A.addedAt, fs, ENV)
  assert.deepEqual(record, APP_A)
  assert.deepEqual(fs.dirs, ['/home/u']) // the single dotfile's parent is $HOME itself
  assert.deepEqual(JSON.parse(fs.files.get(FILE)!), { projects: [APP_A], preferences: {} })

  await addProject('/repos/app-b', APP_B.addedAt, fs, ENV)
  assert.deepEqual(await listProjects(fs, ENV), [APP_A, APP_B])
})

test('addProject is idempotent by resolved path and keeps the original addedAt', async () => {
  const fs = memFs()
  await addProject('/repos/app-a', APP_A.addedAt, fs, ENV)
  for (const variant of ['/repos/app-a', '/repos/app-a/', '/repos/other/../app-a']) {
    const again = await addProject(variant, '2027-01-01T00:00:00.000Z', fs, ENV)
    assert.deepEqual(again, APP_A) // existing record, addedAt untouched
  }
  assert.deepEqual(JSON.parse(fs.files.get(FILE)!), { projects: [APP_A], preferences: {} })
})

test('addProject normalizes the stored path to an absolute one', async () => {
  const fs = memFs()
  const record = await addProject('/repos/app-a/', APP_A.addedAt, fs, ENV)
  assert.equal(record.path, '/repos/app-a')
})

test('removeProject drops the matching record and returns true', async () => {
  const fs = memFs({ [FILE]: JSON.stringify([APP_A, APP_B]) })
  assert.equal(await removeProject(APP_A.id, fs, ENV), true)
  assert.deepEqual(await listProjects(fs, ENV), [APP_B])
})

test('removeProject on an unknown id is false and does not write', async () => {
  const raw = JSON.stringify([APP_A])
  const fs = memFs({ [FILE]: raw })
  assert.equal(await removeProject('nope-123', fs, ENV), false)
  assert.equal(fs.files.get(FILE), raw) // untouched
})

test('removeProject on an empty / missing registry is false', async () => {
  assert.equal(await removeProject(APP_A.id, memFs(), ENV), false)
  assert.equal(await removeProject(APP_A.id, memFs({ [FILE]: '[]' }), ENV), false)
})

// Preferences (#410): stored in the same file next to the project list.

test('readRegistry reads a legacy bare-array file as { projects, preferences: {} }', async () => {
  const raw = JSON.stringify([APP_A, APP_B])
  assert.deepEqual(await readRegistry(memFs({ [FILE]: raw }), ENV), {
    projects: [APP_A, APP_B],
    preferences: {},
  })
})

test('readRegistry reads the object form with preferences and drops unknown/non-boolean fields', async () => {
  const raw = JSON.stringify({
    projects: [APP_A],
    preferences: { vanilla: true, transparent: 'yes', bogus: 1, onBeforeMergeableQuality: true, browser: true },
  })
  assert.deepEqual(await readRegistry(memFs({ [FILE]: raw }), ENV), {
    projects: [APP_A],
    preferences: { vanilla: true, onBeforeMergeableQuality: true, browser: true }, // transparent (non-boolean) + bogus dropped
  })
})

test('every boolean preference survives a save; the sanitizer cannot silently drop one (#944)', async () => {
  // `allOn` is typed over the boolean keys computed from `Preferences` itself, so adding a
  // boolean preference without listing it here is a compile error in this test — and a key the
  // sanitizer's list misses fails the round-trip below, the write-then-vanish shape #944 closes.
  type BooleanKey = {
    [K in keyof Preferences]-?: NonNullable<Preferences[K]> extends boolean ? K : never
  }[keyof Preferences]
  const allOn: Record<BooleanKey, boolean> = {
    vanilla: true,
    onBeforeMergeableQuality: true,
    browser: true,
    transparent: true,
    notifyBrowser: true,
    notifyDiscord: true,
    notifyNewActivity: true,
    notifyHumanIntervention: true,
    autoPm: true,
    bridge: true,
    onboardingDismissed: true,
    reposDirectoryAutoGrant: true,
  }
  const fs = memFs()
  await writePreferences(allOn, fs, ENV)
  assert.deepEqual(await readPreferences(fs, ENV), allOn)
})

test('sanitizePreferences keeps a valid run target and drops junk (#1050)', async () => {
  // The PREFERENCE_KEYS loop is boolean-only, so a string preference needs its own branch or the
  // save silently eats it. A valid target round-trips; an unknown one is dropped to the default.
  const fs = memFs()
  await writePreferences({ target: 'actions' }, fs, ENV)
  assert.deepEqual(await readPreferences(fs, ENV), { target: 'actions' })
  await writePreferences({ target: 'moon' } as never, fs, ENV)
  assert.deepEqual(await readPreferences(fs, ENV), {})
})

test('sanitizePreferences reads a pre-B5 handoff written as three booleans', async () => {
  // Dropping the old keys would not have left those users where they were: absent means the
  // default, and the default publishes. Someone who stored "push nothing" would have come back from
  // an upgrade to branches on the remote and PRs open — done under their name, by a tool they had
  // told not to.
  const stored = (preferences: Record<string, unknown>) =>
    readPreferences(memFs({ [FILE]: JSON.stringify({ projects: [], preferences }) }), ENV)
  assert.deepEqual(await stored({ autoPushBranch: false }), { handoff: 'local' })
  assert.deepEqual(await stored({ autoPushBranch: true, autoOpenPr: false }), { handoff: 'push' })
  assert.deepEqual(await stored({ autoMerge: true }), { handoff: 'merge' })
  // The unreachable combination resolves down, and the new key wins wherever both were written.
  assert.deepEqual(await stored({ autoPushBranch: false, autoOpenPr: true }), { handoff: 'local' })
  assert.deepEqual(await stored({ handoff: 'push', autoMerge: true }), { handoff: 'push' })
  // Saying none of them is still saying nothing: the ladder stays absent rather than being pinned
  // to the default, so a later change of default still reaches these users.
  assert.deepEqual(await stored({ vanilla: true }), { vanilla: true })
})

test('sanitizePreferences keeps an absolute reposDirectory and drops junk (#1123)', async () => {
  // Another string preference the boolean-only loop would eat: kept only as a non-empty absolute
  // path, so a relative or blank value never lands in the file.
  const fs = memFs()
  await writePreferences({ reposDirectory: '/home/u/repos' }, fs, ENV)
  assert.deepEqual(await readPreferences(fs, ENV), { reposDirectory: '/home/u/repos' })
  await writePreferences({ reposDirectory: 'relative/repos' }, fs, ENV)
  assert.deepEqual(await readPreferences(fs, ENV), {})
  await writePreferences({ reposDirectory: '   ' }, fs, ENV)
  assert.deepEqual(await readPreferences(fs, ENV), {})
})

test('sanitizePreferences keeps the routine opt-out list, trimmed and deduplicated (#1209)', async () => {
  // A list preference, so like the string ones the boolean-only loop would eat it whole. Junk
  // entries are dropped one by one rather than taking the list with them: losing the list would
  // switch every routine back on, which spends quota nobody asked to spend.
  const fs = memFs()
  await writePreferences({ autoPmOptOut: ['drain-queue', ' maintenance ', 'drain-queue', '', 7 as never] }, fs, ENV)
  assert.deepEqual(await readPreferences(fs, ENV), { autoPmOptOut: ['drain-queue', 'maintenance'] })
  // Empty is dropped like every other empty list, and means what absent means: nothing opted out.
  // That is exactly what re-ticking the last unticked routine writes, so it has to clear the key.
  assert.deepEqual(await patchPreferences({ autoPmOptOut: [] }, fs, ENV), {})
  await writePreferences({ autoPmOptOut: 'drain-queue' as never }, fs, ENV)
  assert.deepEqual(await readPreferences(fs, ENV), {})
})

test('reposDirectoryAutoGrant is a boolean preference, off by default (#1123)', async () => {
  const fs = memFs()
  assert.equal((await readPreferences(fs, ENV)).reposDirectoryAutoGrant, undefined) // absent = off
  await writePreferences({ reposDirectory: '/home/u/repos', reposDirectoryAutoGrant: true }, fs, ENV)
  assert.deepEqual(await readPreferences(fs, ENV), { reposDirectory: '/home/u/repos', reposDirectoryAutoGrant: true })
})

test('patchPreferences merges only the keys it is given (#1148)', async () => {
  // The dashboard used to send its whole cached object, so a tab that had been open since before
  // someone else's change wrote the old value back over it. A patch touches only what it names.
  const fs = memFs({ [FILE]: JSON.stringify({ projects: [], preferences: { theme: 'dark', driver: 'codex' } }) })

  const stored = await patchPreferences({ notifyBrowser: true }, fs, ENV)

  assert.deepEqual(stored, { theme: 'dark', driver: 'codex', notifyBrowser: true })
  assert.deepEqual(await readPreferences(fs, ENV), stored)
})

test('a patched key still clears the way it always has (#1148)', async () => {
  // No sentinel for "remove": the sanitizer already drops blanks and empty lists, which is how
  // the dashboard clears the editor and the last custom preset.
  const seed = { projects: [], preferences: { editor: 'code', theme: 'dark', customPresets: [{ id: 'a', label: 'A', prompt: 'p' }] } }
  const fs = memFs({ [FILE]: JSON.stringify(seed) })

  assert.deepEqual(await patchPreferences({ editor: '' }, fs, ENV), {
    theme: 'dark',
    customPresets: [{ id: 'a', label: 'A', prompt: 'p' }],
  })
  assert.deepEqual(await patchPreferences({ customPresets: [] }, fs, ENV), { theme: 'dark' })
})

test('patchPreferences sanitizes the merged result, not just the patch (#1148)', async () => {
  // The one rule, applied once to the merge: an unknown key never lands, and a value outside the
  // known set drops the key rather than being stored — the same answer `writePreferences` gives.
  const fs = memFs({ [FILE]: JSON.stringify({ projects: [], preferences: { theme: 'dark', driver: 'codex' } }) })
  assert.deepEqual(await patchPreferences({ theme: 'moon', bogus: 3 } as never, fs, ENV), { driver: 'codex' })
})

test('the preferences store exposes the patch the dashboard writes through (#1148)', async () => {
  const fs = memFs({ [FILE]: JSON.stringify({ projects: [APP_A], preferences: { theme: 'dark' } }) })
  const store = registryPreferencesStore(fs, ENV)

  assert.deepEqual(await store.patch!({ driver: 'codex' }), { theme: 'dark', driver: 'codex' })
})

test('readPreferences on a missing / legacy file is {}', async () => {
  assert.deepEqual(await readPreferences(memFs(), ENV), {})
  assert.deepEqual(await readPreferences(memFs({ [FILE]: JSON.stringify([APP_A]) }), ENV), {})
})

test('writePreferences persists sanitized prefs and preserves the project list', async () => {
  const fs = memFs({ [FILE]: JSON.stringify([APP_A, APP_B]) })
  await writePreferences({ vanilla: false, browser: true, bogus: 3 } as never, fs, ENV)
  assert.deepEqual(JSON.parse(fs.files.get(FILE)!), {
    projects: [APP_A, APP_B],
    preferences: { vanilla: false, browser: true },
  })
  // The project list still reads back unchanged.
  assert.deepEqual(await listProjects(fs, ENV), [APP_A, APP_B])
})

test('writePreferences round-trips and clamps the spend-limit slider (#960)', async () => {
  const fs = memFs({ [FILE]: JSON.stringify([APP_A]) })
  await writePreferences({ autoSpendOffset: -12 }, fs, ENV)
  assert.deepEqual(await readPreferences(fs, ENV), { autoSpendOffset: -12 })

  // The one numeric preference, so it needs its own guard: a hand-edited file must not be able to
  // put the limit somewhere the slider could not reach, and junk must not land in the home file.
  await writePreferences({ autoSpendOffset: 9000 }, fs, ENV)
  assert.deepEqual(await readPreferences(fs, ENV), { autoSpendOffset: MAX_SPEND_OFFSET })
  await writePreferences({ autoSpendOffset: -9000 }, fs, ENV)
  assert.deepEqual(await readPreferences(fs, ENV), { autoSpendOffset: -MAX_SPEND_OFFSET })
  await writePreferences({ autoSpendOffset: Number.NaN }, fs, ENV)
  assert.deepEqual(await readPreferences(fs, ENV), {})
  await writePreferences({ autoSpendOffset: '20' } as never, fs, ENV)
  assert.deepEqual(await readPreferences(fs, ENV), {})
})

test('writePreferences round-trips and clamps the concurrent-agents setting (#1204)', async () => {
  const fs = memFs({ [FILE]: JSON.stringify([APP_A]) })
  await writePreferences({ autoPmConcurrency: 4 }, fs, ENV)
  assert.deepEqual(await readPreferences(fs, ENV), { autoPmConcurrency: 4 })

  // Clamped to the same bound the browser control offers, and floored at one: zero agents is what
  // the `autoPm` switch already spells, and a hand-edited nought would wedge the routine with the
  // switch still reading on.
  await writePreferences({ autoPmConcurrency: 9000 }, fs, ENV)
  assert.deepEqual(await readPreferences(fs, ENV), { autoPmConcurrency: MAX_AUTO_PM_CONCURRENCY })
  await writePreferences({ autoPmConcurrency: 0 }, fs, ENV)
  assert.deepEqual(await readPreferences(fs, ENV), { autoPmConcurrency: 1 })
  await writePreferences({ autoPmConcurrency: -3 }, fs, ENV)
  assert.deepEqual(await readPreferences(fs, ENV), { autoPmConcurrency: 1 })
  // A whole number of agents, and nothing but a number at all.
  await writePreferences({ autoPmConcurrency: 2.6 }, fs, ENV)
  assert.deepEqual(await readPreferences(fs, ENV), { autoPmConcurrency: 3 })
  await writePreferences({ autoPmConcurrency: Number.NaN }, fs, ENV)
  assert.deepEqual(await readPreferences(fs, ENV), {})
  await writePreferences({ autoPmConcurrency: '5' } as never, fs, ENV)
  assert.deepEqual(await readPreferences(fs, ENV), {})
})

test('writePreferences round-trips the notifyDiscord toggle (#627)', async () => {
  const fs = memFs({ [FILE]: JSON.stringify([APP_A]) })
  await writePreferences({ notifyDiscord: true }, fs, ENV)
  assert.deepEqual(await readPreferences(fs, ENV), { notifyDiscord: true })
})

test('writePreferences round-trips the notifyNewActivity toggle (#627)', async () => {
  const fs = memFs({ [FILE]: JSON.stringify([APP_A]) })
  await writePreferences({ notifyNewActivity: true }, fs, ENV)
  assert.deepEqual(await readPreferences(fs, ENV), { notifyNewActivity: true })
})

test('writePreferences round-trips the notifyHumanIntervention toggle (#627)', async () => {
  const fs = memFs({ [FILE]: JSON.stringify([APP_A]) })
  // Default is on, so the persisted value that matters is the explicit opt-out.
  await writePreferences({ notifyHumanIntervention: false }, fs, ENV)
  assert.deepEqual(await readPreferences(fs, ENV), { notifyHumanIntervention: false })
})

test('writePreferences round-trips the transparent toggle (#625)', async () => {
  const fs = memFs({ [FILE]: JSON.stringify([APP_A]) })
  await writePreferences({ transparent: true }, fs, ENV)
  assert.deepEqual(await readPreferences(fs, ENV), { transparent: true })
})

test('writePreferences keeps the model string but drops a blank one (#628)', async () => {
  const fs = memFs({ [FILE]: JSON.stringify([APP_A]) })
  await writePreferences({ model: '  opus  ' }, fs, ENV)
  assert.deepEqual(await readPreferences(fs, ENV), { model: 'opus' }) // trimmed
  await writePreferences({ model: '   ' }, fs, ENV)
  assert.deepEqual(await readPreferences(fs, ENV), {}) // blank -> no choice, dropped
})

test('the word "Default" is not a model, however a file came to hold it (#1143)', async () => {
  // It was a picker label whose stored value was empty. A file carrying it as the *value* would
  // otherwise reach the CLI as `--model Default` and fail the turn on a word nobody chose.
  const fs = memFs({ [FILE]: JSON.stringify([APP_A]) })
  await writePreferences({ model: 'opus' }, fs, ENV)
  await writePreferences({ model: 'Default' }, fs, ENV)
  assert.deepEqual(await readPreferences(fs, ENV), {})
  await writePreferences({ model: ' default ' }, fs, ENV)
  assert.deepEqual(await readPreferences(fs, ENV), {})
})

test('writePreferences keeps a known agent and drops an unknown one (#650)', async () => {
  const fs = memFs({ [FILE]: JSON.stringify([APP_A]) })
  await writePreferences({ driver: 'codex' }, fs, ENV)
  assert.deepEqual(await readPreferences(fs, ENV), { driver: 'codex' })
  await writePreferences({ driver: 'gpt-9000' } as never, fs, ENV) // not in the known set
  assert.deepEqual(await readPreferences(fs, ENV), {}) // dropped
})

test('writePreferences trims a preferred editor and drops a blank one (#727)', async () => {
  const fs = memFs({ [FILE]: JSON.stringify([APP_A]) })
  await writePreferences({ editor: '  cursor  ' }, fs, ENV)
  assert.deepEqual(await readPreferences(fs, ENV), { editor: 'cursor' }) // trimmed
  await writePreferences({ editor: '   ' }, fs, ENV) // blank = no choice
  assert.deepEqual(await readPreferences(fs, ENV), {}) // dropped
})

test('writePreferences keeps a known theme and drops an unknown one (#725)', async () => {
  const fs = memFs({ [FILE]: JSON.stringify([APP_A]) })
  await writePreferences({ theme: 'dark' }, fs, ENV)
  assert.deepEqual(await readPreferences(fs, ENV), { theme: 'dark' })
  await writePreferences({ theme: 'solarized' } as never, fs, ENV) // not in the known set
  assert.deepEqual(await readPreferences(fs, ENV), {}) // dropped, falls back to system
})

test('writePreferences keeps well-formed custom presets and drops malformed ones (#626)', async () => {
  const fs = memFs({ [FILE]: JSON.stringify([APP_A]) })
  await writePreferences(
    {
      customPresets: [
        { id: 'a', label: '  Deep review  ', prompt: '  Audit this PR.  ' }, // trimmed
        { id: 'b', label: '', prompt: 'no label' }, // dropped (empty label)
        { id: 'c', label: 'no prompt', prompt: '  ' }, // dropped (empty prompt)
        { id: 'a', label: 'dup id', prompt: 'x' }, // dropped (duplicate id)
        { label: 'no id', prompt: 'x' }, // dropped (missing id)
        'nonsense', // dropped (not an object)
      ],
    } as never,
    fs,
    ENV,
  )
  assert.deepEqual(await readPreferences(fs, ENV), {
    customPresets: [{ id: 'a', label: 'Deep review', prompt: 'Audit this PR.' }],
  })
})

test('writePreferences omits customPresets entirely when none survive (#626)', async () => {
  const fs = memFs({ [FILE]: JSON.stringify([APP_A]) })
  await writePreferences({ customPresets: [{ id: '', label: 'x', prompt: 'y' }] } as never, fs, ENV)
  assert.deepEqual(await readPreferences(fs, ENV), {}) // empty list -> field left off
})

test('addProject preserves existing preferences', async () => {
  const fs = memFs({ [FILE]: JSON.stringify({ projects: [APP_A], preferences: { vanilla: false } }) })
  await addProject('/repos/app-b', APP_B.addedAt, fs, ENV)
  assert.deepEqual(JSON.parse(fs.files.get(FILE)!), {
    projects: [APP_A, APP_B],
    preferences: { vanilla: false },
  })
})

test('registryPreferencesStore round-trips through the same file', async () => {
  const fs = memFs()
  const store = registryPreferencesStore(fs, ENV)
  assert.deepEqual(await store.read(), {})
  await store.save({ vanilla: true })
  assert.deepEqual(await store.read(), { vanilla: true })
})

test('registryPreferencesStore tells its listener which keys were written (#1161)', async () => {
  // The daemon wakes auto PM only on the write that switched it on, so it needs the caller's own
  // keys — the merged result would say "on" every time anything else was saved while it was on.
  const fs = memFs()
  const written: Preferences[] = []
  const store = registryPreferencesStore(fs, ENV, patch => written.push(patch))
  await store.save({ autoPm: true })
  await store.patch?.({ vanilla: true })
  assert.deepEqual(written, [{ autoPm: true }, { vanilla: true }])
  // The patch still merged, so the listener's narrower view is not the stored one.
  assert.deepEqual(await store.read(), { autoPm: true, vanilla: true })
})

test('a preferences listener that throws does not fail the write (#1161)', async () => {
  // The write already landed; a listener must not be able to report otherwise.
  const fs = memFs()
  const store = registryPreferencesStore(fs, ENV, () => {
    throw new Error('the daemon is mid-shutdown')
  })
  await store.save({ autoPm: true })
  assert.deepEqual(await store.read(), { autoPm: true })
})

test('the registry file is never written in place, only renamed over (#991)', async () => {
  const fs = memFs({ [FILE]: JSON.stringify({ projects: [APP_A], preferences: {} }) })
  await writePreferences({ vanilla: true }, fs, ENV)
  assert.deepEqual(
    fs.written.filter(path => path === FILE),
    [],
    'the live file must only ever be replaced by a rename, so a reader sees the whole old or the whole new one',
  )
  assert.ok(fs.written.every(path => path.startsWith(`${FILE}.`) && path.endsWith('.tmp')))
  assert.deepEqual(await readRegistry(fs, ENV), {
    projects: [APP_A],
    preferences: { vanilla: true },
  })
  assert.equal([...fs.files.keys()].length, 1, 'the temp file is renamed away, not left beside the real one')
})

test('a write that dies partway leaves the previous registry intact (#991)', async () => {
  const stored = JSON.stringify({ projects: [APP_A, APP_B], preferences: { vanilla: false } })
  // The disk fills between the truncate and the flush. Whatever it truncated must not be the live file.
  const fs = memFs({ [FILE]: stored }, { failWritesTo: `${FILE}.${process.pid}.tmp` })
  await assert.rejects(() => writePreferences({ vanilla: true }, fs, ENV), /ENOSPC/)
  assert.equal(fs.files.get(FILE), stored, 'the live file is untouched by a failed write')
  assert.deepEqual(await readRegistry(fs, ENV), {
    projects: [APP_A, APP_B],
    preferences: { vanilla: false },
  })
})

test('concurrent addProject calls both survive rather than the later one dropping the earlier (#991)', async () => {
  const fs = memFs({ [FILE]: JSON.stringify({ projects: [], preferences: {} }) }, { slow: true })
  await Promise.all([addProject('/repos/app-a', APP_A.addedAt, fs, ENV), addProject('/repos/app-b', APP_B.addedAt, fs, ENV)])
  assert.deepEqual(await listProjects(fs, ENV), [APP_A, APP_B])
})

test('a concurrent addProject and writePreferences do not drop each other (#991)', async () => {
  const fs = memFs({ [FILE]: JSON.stringify({ projects: [], preferences: {} }) }, { slow: true })
  await Promise.all([addProject('/repos/app-a', APP_A.addedAt, fs, ENV), writePreferences({ vanilla: true }, fs, ENV)])
  assert.deepEqual(await readRegistry(fs, ENV), {
    projects: [APP_A],
    preferences: { vanilla: true },
  })
})

test('a rejected mutation does not wedge the queue for the next caller (#991)', async () => {
  const temp = `${FILE}.${process.pid}.tmp`
  const fs = memFs({ [FILE]: JSON.stringify({ projects: [], preferences: {} }) }, { failWritesTo: temp })
  await assert.rejects(() => addProject('/repos/app-a', APP_A.addedAt, fs, ENV), /ENOSPC/)
  const healthy = memFs({ [FILE]: JSON.stringify({ projects: [], preferences: {} }) })
  await addProject('/repos/app-b', APP_B.addedAt, healthy, ENV)
  assert.deepEqual(await listProjects(healthy, ENV), [APP_B])
})


test('ensureDaemonToken generates a base64url token, persists it, and reuses it (#1051)', async () => {
  const fs = memFs()
  const first = await ensureDaemonToken(fs, ENV)
  assert.match(first, /^[A-Za-z0-9_-]+$/) // base64url: URL-safe, so it drops into ?token= unencoded
  assert.ok(first.length >= 43) // 32 random bytes as base64url
  // Persisted as a top-level field, never under preferences (never shipped to the browser bundle).
  const stored = JSON.parse(fs.files.get(FILE)!)
  assert.equal(stored.daemonToken, first)
  assert.equal(stored.preferences.daemonToken, undefined)
  // A second call reuses the persisted one rather than rotating it.
  assert.equal(await ensureDaemonToken(fs, ENV), first)
})

test('readDaemonToken returns undefined until one is generated, then the persisted token (#1051)', async () => {
  const fs = memFs()
  assert.equal(await readDaemonToken(fs, ENV), undefined)
  const token = await ensureDaemonToken(fs, ENV)
  assert.equal(await readDaemonToken(fs, ENV), token)
})

test('a non-string / empty daemonToken in a hand-edited file is dropped (#1051)', async () => {
  for (const bad of [42, '', null, {}]) {
    const fs = memFs({ [FILE]: JSON.stringify({ projects: [], preferences: {}, daemonToken: bad }) })
    assert.equal(await readDaemonToken(fs, ENV), undefined)
  }
})

test('the daemon token survives the other registry mutators (#1051)', async () => {
  const fs = memFs()
  const token = await ensureDaemonToken(fs, ENV)
  await addProject('/repos/app-a', APP_A.addedAt, fs, ENV)
  await writePreferences({ vanilla: true }, fs, ENV)
  await removeProject(APP_A.id, fs, ENV)
  assert.equal(await readDaemonToken(fs, ENV), token)
})

test('two concurrent first-binds settle on one shared token, not two (#1051)', async () => {
  const fs = memFs({ [FILE]: JSON.stringify({ projects: [], preferences: {} }) }, { slow: true })
  const [a, b] = await Promise.all([ensureDaemonToken(fs, ENV), ensureDaemonToken(fs, ENV)])
  assert.equal(a, b)
})

// The stored credentials (#1095). They sit at the daemon-token tier — top level, never in
// `preferences` — so they cannot reach the browser bundle or a per-project override.

test('a saved secret round-trips and lands at the top level, not in preferences (#1095)', async () => {
  const fs = memFs()
  await writeSecrets({ discordWebhook: 'https://hook' }, fs, ENV)

  assert.deepEqual(await readSecrets(fs, ENV), { discordWebhook: 'https://hook' })
  const written = JSON.parse(fs.files.get(FILE)!)
  assert.equal(written.secrets.discordWebhook, 'https://hook')
  assert.deepEqual(written.preferences, {})
})

test('a secrets patch leaves the credential it does not mention alone (#1095)', async () => {
  const fs = memFs()
  await writeSecrets({ discordWebhook: 'https://hook' }, fs, ENV)
  await writeSecrets({ discordWebhook: 'https://other' }, fs, ENV)

  assert.deepEqual(await readSecrets(fs, ENV), { discordWebhook: 'https://other' })
})

test('null clears one credential, and clearing the last one drops the block (#1095)', async () => {
  const fs = memFs()
  await writeSecrets({ discordWebhook: 'https://hook' }, fs, ENV)

  await writeSecrets({ discordWebhook: null }, fs, ENV)
  assert.deepEqual(await readSecrets(fs, ENV), {})
  assert.equal('secrets' in JSON.parse(fs.files.get(FILE)!), false)
})

test('a hand-edited secrets block is sanitized: unknown keys and non-strings dropped (#1095)', async () => {
  const raw = JSON.stringify({
    projects: [],
    preferences: {},
    secrets: { discordWebhook: '  https://hook  ', discordBotToken: 42, sshKey: 'nope' },
  })
  assert.deepEqual(await readSecrets(memFs({ [FILE]: raw }), ENV), { discordWebhook: 'https://hook' })
})

test('saving a secret keeps the project list and preferences (#1095)', async () => {
  const fs = memFs()
  await addProject('/repos/app-a', APP_A.addedAt, fs, ENV)
  await writePreferences({ vanilla: true }, fs, ENV)
  await writeSecrets({ discordWebhook: 'https://hook' }, fs, ENV)

  assert.deepEqual(await listProjects(fs, ENV), [APP_A])
  assert.deepEqual(await readPreferences(fs, ENV), { vanilla: true })
  assert.deepEqual(await readSecrets(fs, ENV), { discordWebhook: 'https://hook' })
})

test('the registry file is written owner-only, and the mode is set before the rename (#1095)', async () => {
  const fs = memFs()
  await writeSecrets({ discordWebhook: 'https://hook' }, fs, ENV)

  assert.equal(fs.modes.get(FILE), REGISTRY_FILE_MODE)
  // The temp file carried the mode across the rename, so the real path was never world-readable.
  assert.deepEqual([...fs.modes.keys()], [FILE])
})

test('a filesystem with no chmod still writes the registry (#1095)', async () => {
  const fs = memFs()
  const { chmod: _dropped, ...noChmod } = fs
  await writeSecrets({ discordWebhook: 'https://hook' }, noChmod, ENV)

  assert.deepEqual(await readSecrets(noChmod, ENV), { discordWebhook: 'https://hook' })
})

test('a token stays put when a secret is saved beside it (#1051/#1095)', async () => {
  const fs = memFs()
  const token = await ensureDaemonToken(fs, ENV)
  await writeSecrets({ discordWebhook: 'https://hook' }, fs, ENV)

  assert.equal(await readDaemonToken(fs, ENV), token)
  assert.deepEqual(await readSecrets(fs, ENV), { discordWebhook: 'https://hook' })
})
