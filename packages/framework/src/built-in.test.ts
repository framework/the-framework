import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { BUILT_IN_PACKAGES, builtInBinDirs, builtInPackages, lookupProvided, providedCommand } from './built-in.js'
import { providedGitHost } from './store/git-host.js'

test('every built-in package is installed with the framework, and their commands have a directory each', async () => {
  assert.deepEqual((await builtInPackages()).map(pkg => pkg.name), [...BUILT_IN_PACKAGES])
  const dirs = await builtInBinDirs()
  assert.ok(dirs.length > 0 && dirs.every(dir => basename(dir) === 'bin'), JSON.stringify(dirs))
})

test('a project with nothing installed gets its runs, its branches and a repository to create from the built-in packages, and nothing it has no package for', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'framework-built-in-')))
  try {
    assert.equal((await providedCommand(root, 'runs'))?.package, '@openagt/skill-logs')
    assert.equal((await providedCommand(root, 'branches'))?.package, '@openagt/skill-branches')
    assert.deepEqual(await lookupProvided(root, 'tickets'), {})
    assert.equal((await providedCommand(root, 'repository'))?.package, '@openagt/skill-github', 'the built-in package that can create its repository')
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
    assert.equal((await providedCommand(root, 'branches'))?.package, '@openagt/skill-branches', 'a kind the project has no package for still comes built in')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a built-in git host is a project\'s only when the project\'s remote is on that host', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'framework-built-in-host-')))
  try {
    execFileSync('git', ['init', '-q'], { cwd: root })
    assert.equal(await providedGitHost()(root), undefined, 'no remote: no git host')
    execFileSync('git', ['remote', 'add', 'origin', 'git@gitlab.com:o/r.git'], { cwd: root })
    assert.equal(await providedGitHost()(root), undefined, 'a remote on another host: not its git host')
    execFileSync('git', ['remote', 'set-url', 'origin', 'git@github.com:o/r.git'], { cwd: root })
    const gitHost = await providedGitHost()(root)
    assert.deepEqual(await gitHost?.home(), { url: 'https://github.com/o/r', name: 'GitHub' })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
