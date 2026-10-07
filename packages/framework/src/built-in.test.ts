import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { BUILT_IN_PACKAGES, builtInBinDirs, builtInPackages, lookupProvided, providedCommand, runCleanups } from './built-in.js'
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
    await writeFile(join(own, 'package.json'), JSON.stringify({ name: 'my-logs', bin: { mine: 'bin/mine' }, openagent: { runs: 'mine' } }))
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

test('every package that declares a clean-up is asked, the project\'s own first; a refusal, a failure and an answer that is not one are each a line, and the rest still run', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'framework-built-in-cleanup-')))
  try {
    execFileSync('git', ['init', '-q'], { cwd: root })
    const tool = async (name: string, script: string): Promise<void> => {
      const dir = join(root, 'node_modules', name)
      await mkdir(join(dir, 'bin'), { recursive: true })
      await writeFile(join(dir, 'package.json'), JSON.stringify({ name, bin: { [name]: `bin/${name}` }, openagent: { cleanup: name } }))
      await writeFile(join(dir, 'bin', name), script)
    }
    await tool('tidy', `require('node:fs').writeFileSync('asked.txt', process.argv.slice(2).join(' ')); console.log(JSON.stringify({ ok: true, removed: ['.tidy'], kept: [{ path: '.tidy-notes', reason: 'yours' }] }))`)
    await tool('busy', `console.log(JSON.stringify({ ok: false, reason: 'running' })); console.error('a run is still working here'); process.exit(1)`)
    await tool('odd', `console.log(JSON.stringify({ ok: true, removed: 'everything' }))`)
    await writeFile(join(root, 'package.json'), JSON.stringify({ dependencies: { tidy: '1.0.0', busy: '1.0.0', odd: '1.0.0' } }))

    assert.deepEqual(await runCleanups(root), {
      removed: ['.tidy'],
      kept: [{ path: '.tidy-notes', reason: 'yours' }],
      failed: ['busy: a run is still working here', 'odd: its clean-up answered something else than what it removed and kept'],
    })
    assert.equal(execFileSync('cat', ['asked.txt'], { cwd: root, encoding: 'utf8' }), 'cleanup', 'run in the project, with the one word')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
