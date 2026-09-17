import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { findRun } from '@gemstack/skill-logs'
import { detachRun } from './scheduler.js'
import { DEFAULT_STATE, writeState } from './state.js'
import { removeRepo, testRepo } from './test-repo.js'

// The detached start, with the spawn faked: the marker on the branch, the process asked for, the id answered.

const NOW = new Date('2026-09-17T20:00:00.000Z')

test('run --detach writes the marker, spawns the run with its id, and answers the id at once', async () => {
  const repo = await testRepo()
  try {
    await writeState(repo, { ...DEFAULT_STATE, model: 'sonnet' })
    const spawned: unknown[] = []
    const started = await detachRun(repo, { prompt: '/work-queue now', now: () => NOW }, { spawn: async (_repo, run) => { spawned.push(run) }, host: 'this-box' })
    assert.deepEqual(started, { id: '2026-09-17T20-00-00-000Z', command: 'work-queue', model: 'sonnet' })
    assert.deepEqual(spawned, [{ id: started.id, command: 'work-queue', prompt: '/work-queue now', model: 'sonnet' }])
    const card = await findRun(repo, started.id)
    assert.equal(card?.status, 'running', 'the marker counts against the command\'s cap from now on')
    assert.equal(card?.intent, '/work-queue now')
    assert.deepEqual(card?.caller?.['scheduler'], { command: 'work-queue', host: 'this-box' }, 'no pid yet: the process does not exist')
    const plain = await detachRun(repo, { prompt: 'Read the docs', model: 'opus', now: () => new Date(NOW.getTime() + 1000) }, { spawn: async () => {}, host: 'this-box' })
    assert.equal(plain.command, 'Read')
    assert.equal(plain.model, 'opus')
  } finally {
    await removeRepo(repo)
  }
})
