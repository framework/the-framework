import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { findRun } from '@gemstack/skill-logs'
import { CodexDriver, FakeDriver, type Driver } from 'agent-driver'
import { runCommand } from './run.js'
import { detachResume, detachRun, driverFor, resumeArgs, resumeProject, runArgs } from './scheduler.js'
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
    assert.deepEqual(started, { id: '2026-09-17T20-00-00-000Z', command: 'work-queue', driver: 'claude-code', model: 'sonnet' })
    assert.deepEqual(spawned, [{ id: started.id, command: 'work-queue', prompt: '/work-queue now', driver: 'claude-code', model: 'sonnet' }])
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

test('run --detach --resume spawns the resume of a recorded run and answers its id at once; an unknown run is refused', async () => {
  const repo = await testRepo()
  try {
    const started = await detachRun(repo, { prompt: '/work-queue', now: () => NOW }, { spawn: async () => {}, host: 'this-box' })
    const spawned: unknown[] = []
    const spawn = async (_repo: string, run: unknown): Promise<void> => { spawned.push(run) }
    assert.deepEqual(await detachResume(repo, { id: started.id, answer: 'Yes' }, { spawn }), { id: started.id })
    assert.deepEqual(spawned, [{ id: started.id, answer: 'Yes' }])
    await assert.rejects(detachResume(repo, { id: 'no-such-run', text: 'go on' }, { spawn }), /no run no-such-run in this project/)
    assert.equal(spawned.length, 1)
    assert.deepEqual(resumeArgs({ id: 'r1', text: 'go on' }), ['run', '--resume', 'r1', 'go on'])
    assert.deepEqual(resumeArgs({ id: 'r1', answer: 'Yes', model: 'opus' }), ['run', '--resume', 'r1', '--answer', 'Yes', '--model', 'opus'])
  } finally {
    await removeRepo(repo)
  }
})

test('run --detach on Codex: the marker and the spawned run name Codex, and no model: the state\'s model is a Claude model', async () => {
  const repo = await testRepo()
  try {
    await writeState(repo, { ...DEFAULT_STATE, model: 'sonnet' })
    const spawned: unknown[] = []
    const started = await detachRun(repo, { prompt: '/work-queue', driver: 'codex', now: () => NOW }, { spawn: async (_repo, run) => { spawned.push(run) }, host: 'this-box' })
    assert.deepEqual(started, { id: '2026-09-17T20-00-00-000Z', command: 'work-queue', driver: 'codex' })
    assert.deepEqual(spawned, [{ id: started.id, command: 'work-queue', prompt: '/work-queue', driver: 'codex' }])
    const card = await findRun(repo, started.id)
    assert.equal(card?.driver, 'codex')
    assert.equal(card?.model, undefined)
    const named = await detachRun(repo, { prompt: '/work-queue', driver: 'codex', model: 'gpt-5', now: () => new Date(NOW.getTime() + 1000) }, { spawn: async () => {}, host: 'this-box' })
    assert.equal(named.model, 'gpt-5', 'a model given by hand is passed on')
  } finally {
    await removeRepo(repo)
  }
})

test('a run\'s Codex has full access and the run\'s id in its environment, as its Claude Code has', () => {
  const codex = driverFor('codex', 'run-1')
  assert.ok(codex instanceof CodexDriver)
  const opts = (codex as unknown as { opts: { sandbox?: string; env?: NodeJS.ProcessEnv } }).opts
  assert.equal(opts.sandbox, 'danger-full-access')
  assert.equal(opts.env?.['AGENT_ID'], 'run-1')
  assert.equal(driverFor('claude-code', 'run-1').id, 'claude-code')
})

test('a resumed run continues on the tool its record names, and a Codex run with no model resumes with none', async () => {
  const repo = await testRepo()
  try {
    const startedWith: Array<{ model?: string }> = []
    const codex = (turn: string): Driver => ({
      id: 'codex',
      start: opts => {
        startedWith.push({ ...(opts.model !== undefined ? { model: opts.model } : {}) })
        return new FakeDriver({ turns: [{ text: turn }], sessionId: 's-codex' }).start(opts)
      },
    })
    const first = await runCommand(repo, { prompt: 'Read the docs', driver: codex('Read.'), host: 'this-box', pid: 4242, now: () => NOW, gh: async () => '[]' })
    assert.equal(first.status, 'done')
    const asked: string[] = []
    const second = await resumeProject(repo, { id: first.id, text: 'And the tests?' }, { driverFor: name => { asked.push(name); return codex('Read too.') }, gh: async () => '[]' })
    assert.equal(second.status, 'done')
    assert.deepEqual(asked, ['codex'])
    assert.deepEqual(startedWith, [{}, {}], 'no model named at the start nor at the resume: Codex runs on its own default')
  } finally {
    await removeRepo(repo)
  }
})

test('a spawned run is told its tool, and its model only when it has one', () => {
  assert.deepEqual(runArgs({ id: 'r1', command: 'work-queue', prompt: '/work-queue', model: 'opus' }), ['run', '/work-queue', '--id', 'r1', '--command', 'work-queue', '--model', 'opus'])
  assert.deepEqual(runArgs({ id: 'r1', command: 'work-queue', prompt: '/work-queue', driver: 'codex' }), ['run', '/work-queue', '--id', 'r1', '--command', 'work-queue', '--driver', 'codex'])
})
