import { strict as assert } from 'node:assert'
import { execFileSync } from 'node:child_process'
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import type { ModuleServerHost, RunFacts } from 'framework/module-server'
import server from './server.js'

let dir: string
let root: string
const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()

/** The host for the project at `root` whose runs have the given facts. */
const host = (runs: Record<string, RunFacts> = {}): ModuleServerHost => ({
  root,
  run: async id => runs[id],
  mergeCommit: async () => ({ pending: false }),
})
const read = (name: string, input: Record<string, unknown>, runs?: Record<string, RunFacts>) => server.reads[name]!(host(runs), input)

before(async () => {
  dir = await realpath(await mkdtemp(join(tmpdir(), 'files-server-')))
  root = join(dir, 'repo')
  execFileSync('git', ['init', '-q', '-b', 'main', root])
  git(root, 'config', 'user.email', 't@t')
  git(root, 'config', 'user.name', 't')
  await writeFile(join(root, 'a.txt'), 'a\n')
  git(root, 'add', '-A')
  git(root, 'commit', '-q', '-m', 'base')
  // The person's own edit in the project folder, and a new file.
  await writeFile(join(root, 'a.txt'), 'mine\n')
  await writeFile(join(root, 'new.txt'), 'new\n')
})
after(() => rm(dir, { recursive: true, force: true }))

test('the project read lists its files and marks what is changed on disk, uncommitted', async () => {
  assert.deepEqual(await read('project', {}), {
    files: ['a.txt', 'new.txt'],
    changes: { 'a.txt': { status: 'modified', committed: false }, 'new.txt': { status: 'untracked', committed: false } },
  })
})

test('a diff or a file without a run is the project folder’s', async () => {
  const diff = (await read('diff', { path: 'a.txt' })) as { patch: string }
  assert.match(diff.patch, /\+mine/)
  assert.equal(await read('diff', { path: 'nothing-changed.txt' }), null)
  assert.equal(((await read('content', { path: 'new.txt' })) as { text: string }).text, 'new')
  assert.equal(await read('content', { path: '../outside' }), null)
})

test('a run’s changes are its own checkout’s; a run with none never shows the project folder’s as its own', async () => {
  const checkout = join(dir, 'wt')
  git(root, 'worktree', 'add', '-q', '-b', 'agent-x', checkout)
  await writeFile(join(checkout, 'b.txt'), 'b\n')
  const runs = { 'run-x': { checkout, changedNothing: false }, 'run-ended': { record: { status: 'done' }, changedNothing: false } }
  assert.deepEqual(((await read('changes', { agentId: 'run-x' }, runs)) as { path: string }[]).map(c => c.path), ['b.txt'])
  assert.deepEqual(await read('changes', { agentId: 'run-ended' }, runs), [])
  assert.deepEqual(await read('changes', {}, runs), [])
})

test('a tree read for a run the host does not know is gone', async () => {
  assert.deepEqual(await read('tree', { agentId: 'run-unknown' }), { source: 'gone' })
  assert.deepEqual(await read('tree', {}), { source: 'gone' })
})
