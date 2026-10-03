import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { BUILT_IN_PACKAGES, builtInBinDirs, builtInPackages, lookupProvided, providedCommand } from './built-in.js'

test('every built-in package is installed with the framework, and their commands have a directory each', async () => {
  assert.deepEqual((await builtInPackages()).map(pkg => pkg.name), [...BUILT_IN_PACKAGES])
  const dirs = await builtInBinDirs()
  assert.ok(dirs.length > 0 && dirs.every(dir => basename(dir) === 'bin'), JSON.stringify(dirs))
})

test('a project with nothing installed gets its runs and branches from the built-in packages, and nothing it has no package for', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'framework-built-in-')))
  try {
    assert.equal((await providedCommand(root, 'runs'))?.package, '@gemstack/skill-logs')
    assert.equal((await providedCommand(root, 'branches'))?.package, '@gemstack/skill-branches')
    assert.deepEqual(await lookupProvided(root, 'tickets'), {})
    assert.deepEqual(await lookupProvided(root, 'git-host'), {})
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a project\'s own package for a kind wins over the built-in one', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'framework-built-in-own-')))
  try {
    const own = join(root, 'node_modules', 'my-logs')
    await mkdir(join(own, 'bin'), { recursive: true })
    await writeFile(join(own, 'package.json'), JSON.stringify({ name: 'my-logs', bin: { mine: 'bin/mine' }, framework: { runs: 'mine' } }))
    await writeFile(join(own, 'bin', 'mine'), '')
    await writeFile(join(root, 'package.json'), JSON.stringify({ dependencies: { 'my-logs': '1.0.0' } }))
    assert.equal((await providedCommand(root, 'runs'))?.package, 'my-logs')
    assert.equal((await providedCommand(root, 'branches'))?.package, '@gemstack/skill-branches', 'a kind the project has no package for still comes built in')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
