import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { nodeGitRunner } from '@gemstack/agent-data'
import { DEFAULT_STATE, readState, statePath, updateState, writeState } from './state.js'
import { STATE_DIR } from './names.js'

const git = nodeGitRunner()

async function repo(): Promise<string> {
  const path = await realpath(await mkdtemp(join(tmpdir(), 'scheduler-state-')))
  await git(['init', '-q', '-b', 'main'], path)
  return path
}

test('no state file reads as the default: off, no keep-alive, opus, the half-day cushion', async () => {
  const root = await repo()
  try {
    assert.deepEqual(await readState(root), DEFAULT_STATE)
    assert.equal(DEFAULT_STATE.on, false)
    assert.equal(DEFAULT_STATE.model, 'opus')
    assert.ok(Math.abs(DEFAULT_STATE.spendOffset - 100 / 14) < 1e-9)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('the first write hides the directory from git through the exclude file; a read gives back what was written, defaults filled', async () => {
  const root = await repo()
  try {
    await writeState(root, { ...DEFAULT_STATE, on: true, pid: 4242 })
    assert.match(await readFile(join(root, '.git', 'info', 'exclude'), 'utf8'), new RegExp(`^/${STATE_DIR}$`, 'm'))
    assert.equal((await git(['status', '--porcelain'], root)).trim(), '', 'nothing of the state shows in the project')
    await writeFile(statePath(root), '{"on": true}')
    assert.deepEqual(await readState(root), { ...DEFAULT_STATE, on: true })
    const next = await updateState(root, s => ({ ...s, model: 'sonnet' }))
    assert.equal(next.model, 'sonnet')
    assert.equal((await readState(root)).model, 'sonnet')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a state file that does not parse reads as the default rather than stopping the tick', async () => {
  const root = await repo()
  try {
    await writeState(root, DEFAULT_STATE)
    await writeFile(statePath(root), '{not json')
    assert.deepEqual(await readState(root), DEFAULT_STATE)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
