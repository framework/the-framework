import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { FakeDriver, type Driver, type DriverSession, type DriverStartOptions } from 'agent-driver'
import { worktreePath } from '@gemstack/skill-branches'
import { findRun, readDiary } from '@gemstack/skill-logs'
import { readLiveMeta } from './live-log.js'
import { runCommand } from './run.js'
import { git, removeRepo, testRepo } from './test-repo.js'

// One run end to end on a real repository, with the agent faked: the marker, the checkout, the
// live log in the dashboard's shape, the record with what the agent said and cost, the reclaim.

const NOW = new Date('2026-09-16T14:01:00.000Z')

/** An agent that commits one file on a branch it names itself, the way a real one does. */
function committingDriver(): Driver {
  return {
    id: 'fake',
    start: async (opts: DriverStartOptions): Promise<DriverSession> => ({
      id: 'fake-1',
      cwd: opts.cwd,
      prompt: async text => {
        opts.onEvent?.({ type: 'start', prompt: text })
        await git(['config', 'user.email', 'agent@example.com'], opts.cwd)
        await git(['config', 'user.name', 'agent'], opts.cwd)
        await git(['branch', '-m', 'agent-fix-it'], opts.cwd)
        await writeFile(join(opts.cwd, 'fixed.txt'), 'fixed\n')
        await git(['add', '-A'], opts.cwd)
        await git(['commit', '-q', '-m', 'Fix it'], opts.cwd)
        opts.onEvent?.({ type: 'text', text: 'Fixed it and committed.' })
        opts.onEvent?.({ type: 'result', text: 'Fixed it and committed.', sessionId: 's-1', usage: { costUsd: 0.5, inputTokens: 10, outputTokens: 5, cacheReadTokens: 0, cacheCreationTokens: 0 } })
        return { text: 'Fixed it and committed.', sessionId: 's-1' }
      },
      dispose: async () => {},
    }),
  }
}

test('a run: marker, checkout, live log, the prompt once, the record, the checkout reclaimed once the branch is on origin', async () => {
  const repo = await testRepo()
  try {
    const seen: { id: string; meta?: unknown } = { id: '' }
    const driver = committingDriver()
    const wrapped: Driver = {
      id: driver.id,
      start: async opts => {
        // Mid-run: the live log is what the dashboard reads, running under this pid.
        seen.id = opts.cwd
        seen.meta = await readLiveMeta(opts.cwd)
        return driver.start(opts)
      },
    }
    const gh = async (args: string[]) => {
      assert.deepEqual(args.slice(0, 3), ['pr', 'list', '--head'])
      return JSON.stringify([{ number: 12, url: 'https://github.com/x/y/pull/12' }])
    }
    const outcome = await runCommand(repo, { prompt: '/work-queue', model: 'opus', driver: wrapped, host: 'this-box', pid: 4242, now: () => NOW, gh })
    assert.equal(outcome.id, '2026-09-16T14-01-00-000Z')
    assert.equal(outcome.status, 'done')
    assert.equal(outcome.branch, 'agent-fix-it')
    assert.deepEqual(outcome.pr, { number: 12, url: 'https://github.com/x/y/pull/12' })
    assert.equal(outcome.cost, 0.5)
    assert.deepEqual(outcome.checkout, { reclaimed: true })

    const meta = seen.meta as Record<string, unknown>
    assert.equal(seen.id, worktreePath(repo, outcome.id))
    assert.equal(meta['status'], 'running')
    assert.equal(meta['pid'], 4242)
    assert.equal(meta['host'], 'this-box')
    assert.equal(meta['intent'], '/work-queue')
    assert.equal(meta['branch'], 'agent-2026-09-16T14-01-00-000Z')
    assert.equal(meta['kind'], 'prompt')
    assert.deepEqual(meta['scheduler'], { command: 'work-queue', host: 'this-box', pid: 4242 })

    // The checkout went: the branch reached origin, the record is the only trace.
    assert.equal(await stat(worktreePath(repo, outcome.id)).then(() => true, () => false), false)
    assert.equal((await git(['rev-parse', '--verify', 'refs/remotes/origin/agent-fix-it'], repo)).trim().length, 40)
    const card = await findRun(repo, outcome.id)
    assert.equal(card?.status, 'done')
    assert.equal(card?.branch, 'agent-fix-it')
    assert.equal(card?.cost, 0.5)
    assert.equal(card?.model, 'opus')
    assert.equal(card?.driver, 'fake')
    assert.deepEqual(card?.caller?.['scheduler'], { command: 'work-queue', host: 'this-box', pid: 4242 })
    const diary = (await readDiary(repo, outcome.id))!
    assert.deepEqual(diary.map(line => line.kind), ['session', 'intent', 'branch', 'driver', 'said', 'result', 'session-update', 'cost', 'branch', 'ended'])
    assert.deepEqual(diary.find(l => l.kind === 'said'), { kind: 'said', text: 'Fixed it and committed.' })
    assert.deepEqual(diary.find(l => l.kind === 'ended'), { kind: 'ended', status: 'done' })
  } finally {
    await removeRepo(repo)
  }
})

test("an agent that commits nothing: done, no PR, its empty branch goes with the checkout; a driver that throws: failed with the reason, checkout reclaimed", async () => {
  const repo = await testRepo()
  try {
    const quiet = await runCommand(repo, { prompt: '/work-queue', model: 'opus', driver: new FakeDriver({ turns: [{ text: 'Nothing is queued.' }] }), now: () => NOW, gh: async () => '[]' })
    assert.equal(quiet.status, 'done')
    assert.equal(quiet.pr, undefined)
    assert.deepEqual(quiet.checkout, { reclaimed: true })
    assert.equal((await git(['branch', '--list', `agent-${quiet.id}`], repo)).trim(), '', 'a branch holding nothing goes with its checkout')

    const dying: Driver = { id: 'fake', start: async () => { throw new Error('claude: not logged in') } }
    const failed = await runCommand(repo, { prompt: '/work-queue', model: 'opus', driver: dying, now: () => new Date(NOW.getTime() + 60_000), gh: async () => '[]' })
    assert.equal(failed.status, 'failed')
    assert.equal(failed.detail, 'claude: not logged in')
    const card = await findRun(repo, failed.id)
    assert.equal(card?.status, 'failed')
    assert.deepEqual((await readDiary(repo, failed.id))!.at(-1), { kind: 'ended', status: 'failed', detail: 'claude: not logged in' })
  } finally {
    await removeRepo(repo)
  }
})

test('the tick\'s run does not mark itself again, and a dirty tree keeps the checkout with the reason', async () => {
  const repo = await testRepo()
  try {
    const messy: Driver = {
      id: 'fake',
      start: async opts => ({
        id: 'x',
        cwd: opts.cwd,
        prompt: async () => {
          await writeFile(join(opts.cwd, 'scratch.txt'), 'uncommitted\n')
          return { text: 'left a mess' }
        },
        dispose: async () => {},
      }),
    }
    const outcome = await runCommand(repo, { prompt: '/work-queue', id: 'given-id', marked: true, model: 'opus', driver: messy, now: () => NOW, gh: async () => '[]' })
    assert.equal(outcome.id, 'given-id')
    assert.equal(outcome.status, 'done')
    assert.deepEqual(outcome.checkout, { reclaimed: false, reason: 'dirty' })
    assert.equal(await readFile(join(worktreePath(repo, 'given-id'), 'scratch.txt'), 'utf8'), 'uncommitted\n')
    // The record was still written, over no marker, since the tick's marker is the tick's.
    assert.equal((await findRun(repo, 'given-id'))?.status, 'done')
  } finally {
    await removeRepo(repo)
  }
})
