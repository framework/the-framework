import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { appendInbox, FakeDriver, type Driver, type DriverSession, type DriverStartOptions, type FakeDriverSession } from 'agent-driver'
import { worktreePath } from '@gemstack/skill-branches'
import { findRun, readDiary } from '@gemstack/skill-logs'
import { inboxPath, readLiveCard } from './live-card.js'
import { acquireRunLock, releaseRunLock } from './run-lock.js'
import { resumeRun, runCommand, STOPPED_DETAIL } from './run.js'
import { git, removeRepo, testRepo } from './test-repo.js'

// One run end to end on a real repository, with the agent faked: the marker, the checkout, the
// live card the session keeps, the record with what the agent said and cost, the reclaim; a run
// that ends on a question, kept and resumed with the answer.

const NOW = new Date('2026-09-16T14:01:00.000Z')


/** A fake session with something done before each prompt: the spread of a class instance loses its methods, so the wrapper is explicit. */
function wrap(fake: FakeDriverSession, before: (text: string) => Promise<void>): DriverSession & { prompts: string[] } {
  return {
    id: fake.id,
    cwd: fake.cwd,
    prompts: fake.prompts,
    ...(fake.log ? { log: fake.log } : {}),
    prompt: async (text, opts) => {
      await before(text)
      return fake.prompt(text, opts)
    },
    dispose: () => fake.dispose(),
  }
}

const QUESTION = 'Plan written.\n\n```await-choices\n{ "title": "Ship it?", "options": [{ "label": "Approve" }, { "label": "Decline", "stop": true }], "recommended": "Approve" }\n```\n'

/** An agent that commits one file on a branch it names itself, the way a real one does. */
function committingDriver(): Driver {
  return {
    id: 'fake',
    start: async (opts: DriverStartOptions): Promise<DriverSession> => {
      const fake = await new FakeDriver({
        respond: () => ({ text: 'Fixed it and committed.', usage: { costUsd: 0.5, inputTokens: 10, outputTokens: 5, cacheReadTokens: 0, cacheCreationTokens: 0 } }),
        sessionId: 's-1',
      }).start(opts)
      return wrap(fake, async () => {
        await git(['config', 'user.email', 'agent@example.com'], opts.cwd)
        await git(['config', 'user.name', 'agent'], opts.cwd)
        await git(['branch', '-m', 'agent-fix-it'], opts.cwd)
        await writeFile(join(opts.cwd, 'fixed.txt'), 'fixed\n')
        await git(['add', '-A'], opts.cwd)
        await git(['commit', '-q', '-m', 'Fix it'], opts.cwd)
      })
    },
  }
}

test('a run: marker, checkout, the live card, the prompt once, the record, the checkout reclaimed once the branch is on origin', async () => {
  const repo = await testRepo()
  try {
    const seen: { cwd: string; card?: unknown } = { cwd: '' }
    const driver = committingDriver()
    const wrapped: Driver = {
      id: driver.id,
      start: async opts => {
        const session = await driver.start(opts)
        // Mid-run: the live card is what the dashboard reads, running under this pid.
        await session.log?.settled()
        seen.cwd = opts.cwd
        seen.card = await readLiveCard(opts.cwd, '2026-09-16T14-01-00-000Z')
        return session
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

    const card = seen.card as Record<string, unknown>
    assert.equal(seen.cwd, worktreePath(repo, outcome.id))
    assert.equal(card['status'], 'running')
    assert.equal(card['intent'], '/work-queue')
    assert.equal(card['branch'], 'agent-2026-09-16T14-01-00-000Z')
    assert.deepEqual(card['caller'], { scheduler: { command: 'work-queue', host: 'this-box', pid: 4242 }, pid: 4242, host: 'this-box', kind: 'prompt', workspace: seen.cwd })

    // The checkout went: the branch reached origin, the record is the only trace.
    assert.equal(await stat(worktreePath(repo, outcome.id)).then(() => true, () => false), false)
    assert.equal((await git(['rev-parse', '--verify', 'refs/remotes/origin/agent-fix-it'], repo)).trim().length, 40)
    const recorded = await findRun(repo, outcome.id)
    assert.equal(recorded?.status, 'done')
    assert.equal(recorded?.branch, 'agent-fix-it')
    assert.deepEqual(recorded?.pr, { number: 12, url: 'https://github.com/x/y/pull/12' })
    assert.equal(recorded?.cost, 0.5)
    assert.equal(recorded?.model, 'opus')
    assert.equal(recorded?.driver, 'fake')
    assert.equal(recorded?.caller?.['sessionId'], 's-1')
    assert.deepEqual(recorded?.caller?.['scheduler'], { command: 'work-queue', host: 'this-box', pid: 4242 })
    const diary = (await readDiary(repo, outcome.id))!
    assert.deepEqual(diary.map(line => line.kind), ['start', 'said', 'result', 'cost', 'ended'])
    assert.deepEqual(diary.find(l => l.kind === 'said'), { kind: 'said', text: 'Fixed it and committed.' })
    assert.deepEqual(diary.at(-1), { kind: 'ended', status: 'done' })
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
      start: async opts => {
        const fake = await new FakeDriver({ turns: [{ text: 'left a mess' }] }).start(opts)
        return wrap(fake, async () => {
          await writeFile(join(opts.cwd, 'scratch.txt'), 'uncommitted\n')
        })
      },
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

test('a signal to the run\'s process stops it: the session aborted, the run recorded `stopped`, the checkout reclaimed', async () => {
  const repo = await testRepo()
  try {
    let prompted!: () => void
    const started = new Promise<void>(resolve => (prompted = resolve))
    // An agent that works until told to stop, the way agent-driver ends a session on its signal.
    const patient: Driver = {
      id: 'fake',
      start: async (opts: DriverStartOptions): Promise<DriverSession> => {
        const fake = await new FakeDriver({ turns: [{ text: 'Working…' }] }).start(opts)
        return {
          id: fake.id,
          cwd: fake.cwd,
          ...(fake.log ? { log: fake.log } : {}),
          prompt: async (text, promptOpts) => {
            const turn = await fake.prompt(text, promptOpts)
            prompted()
            // A bound wait: nothing else holds the event loop open while the signal is in flight.
            await new Promise<void>((_, reject) => {
              const timer = setTimeout(() => reject(new Error('no signal within 5s')), 5000)
              opts.signal!.addEventListener('abort', () => {
                clearTimeout(timer)
                reject(new Error('fake prompt aborted'))
              }, { once: true })
            })
            return turn
          },
          dispose: () => fake.dispose(),
        }
      },
    }
    const running = runCommand(repo, { prompt: '/work-queue', model: 'opus', driver: patient, now: () => NOW, gh: async () => '[]' })
    await started
    process.kill(process.pid, 'SIGINT') // what a dashboard's Stop sends; this test's own process has the run's handler
    const outcome = await running
    assert.equal(outcome.status, 'stopped')
    assert.equal(outcome.detail, STOPPED_DETAIL)
    assert.deepEqual(outcome.checkout, { reclaimed: true })
    const card = await findRun(repo, outcome.id)
    assert.equal(card?.status, 'stopped')
    const diary = (await readDiary(repo, outcome.id))!
    assert.deepEqual(diary.find(l => l.kind === 'said'), { kind: 'said', text: 'Working…' })
    assert.deepEqual(diary.at(-1), { kind: 'ended', status: 'stopped', detail: STOPPED_DETAIL })
  } finally {
    await removeRepo(repo)
  }
})

test('a run whose last turn asked ends waiting and keeps its checkout; the answer resumes the same run, which then ends done and reclaimed', async () => {
  const repo = await testRepo()
  try {
    // First session: the agent asks. Second session, resumed by the recorded id: it finishes.
    const asking = new FakeDriver({ turns: [{ text: QUESTION }], sessionId: 's-ask' })
    const first = await runCommand(repo, { prompt: '/work-queue', model: 'opus', driver: asking, host: 'this-box', pid: 4242, now: () => NOW, gh: async () => '[]' })
    assert.equal(first.status, 'waiting')
    assert.deepEqual(first.checkout, { reclaimed: false, reason: 'waiting' })
    assert.equal(await stat(worktreePath(repo, first.id)).then(() => true, () => false), true, 'the checkout waits for the answer')
    const waiting = await findRun(repo, first.id)
    assert.equal(waiting?.status, 'waiting')
    assert.equal(waiting?.caller?.['sessionId'], 's-ask')
    const before = (await readDiary(repo, first.id))!
    assert.deepEqual(before.map(l => l.kind), ['start', 'said', 'result', 'question', 'ended'])
    assert.deepEqual(before.at(-1), { kind: 'ended', status: 'waiting' })

    // A message written to the inbox before the turn ended would have been drained; here nothing waited.
    assert.equal(await stat(inboxPath(worktreePath(repo, first.id))).then(() => true, () => false), false)

    let resumedWith: string | undefined
    const finishing: Driver = {
      id: 'fake',
      start: async opts => {
        resumedWith = opts.resumeSessionId
        return new FakeDriver({ turns: [{ text: 'Shipped.' }], sessionId: 's-ask' }).start(opts)
      },
    }
    const second = await resumeRun(repo, { id: first.id, answer: 'Approve', driver: finishing, host: 'this-box', pid: 4243, now: () => new Date(NOW.getTime() + 3_600_000), gh: async () => '[]' })
    assert.equal(resumedWith, 's-ask', 'the session resumes by the id the record carries')
    assert.equal(second.id, first.id, 'the same run')
    assert.equal(second.status, 'done')
    assert.deepEqual(second.checkout, { reclaimed: true })
    const done = await findRun(repo, first.id)
    assert.equal(done?.status, 'done')
    assert.equal(done?.startedAt, NOW.toISOString(), 'the start is the original one')
    const after = (await readDiary(repo, first.id))!
    assert.deepEqual(after.map(l => l.kind), ['start', 'said', 'result', 'question', 'ended', 'start', 'said', 'result', 'ended'], 'the diary goes on from where it stopped')
    assert.deepEqual(after.at(-1), { kind: 'ended', status: 'done' })
    const resumePrompt = after.find((l, i) => l.kind === 'start' && i > 4)
    assert.equal(resumePrompt?.['prompt'], 'You paused to ask: "Ship it?". The user chose: Approve. Continue with that decision.')
  } finally {
    await removeRepo(repo)
  }
})

test('a line already in the inbox when the turn ends becomes the next turn of the same run', async () => {
  const repo = await testRepo()
  try {
    const chatty: Driver = {
      id: 'fake',
      start: async opts => {
        const fake = await new FakeDriver({ turns: [{ text: 'First turn done.' }, { text: 'Second turn done.' }] }).start(opts)
        return wrap(fake, async () => {
          if (fake.prompts.length === 0) await appendInbox(inboxPath(opts.cwd), { kind: 'message', text: 'also add a test' })
        })
      },
    }
    const outcome = await runCommand(repo, { prompt: '/work-queue', model: 'opus', driver: chatty, now: () => NOW, gh: async () => '[]' })
    assert.equal(outcome.status, 'done')
    const diary = (await readDiary(repo, outcome.id))!
    assert.deepEqual(diary.filter(l => l.kind === 'start').map(l => l['prompt']), ['/work-queue', 'also add a test'])
    assert.deepEqual(diary.filter(l => l.kind === 'said').map(l => l['text']), ['First turn done.', 'Second turn done.'])
  } finally {
    await removeRepo(repo)
  }
})

test('a line written after the last turn took the inbox, while the card still said running, is sent by the same process before the run ends', async () => {
  const repo = await testRepo()
  try {
    const driver = new FakeDriver({ turns: [{ text: 'First turn done.' }, { text: 'Late line handled.' }] })
    let cwd = ''
    const recording: Driver = { id: 'fake', start: async opts => ((cwd = opts.cwd), driver.start(opts)) }
    // The pull request is read after the last turn and before the card says ended: the moment a
    // dashboard still sees the run working and hands it a line.
    let calls = 0
    const gh = async () => {
      if (calls++ === 0) await appendInbox(inboxPath(cwd), { kind: 'message', text: 'one more thing' })
      return '[]'
    }
    const outcome = await runCommand(repo, { prompt: '/work-queue', model: 'opus', driver: recording, now: () => NOW, gh })
    assert.equal(outcome.status, 'done')
    assert.deepEqual(outcome.checkout, { reclaimed: true })
    const diary = (await readDiary(repo, outcome.id))!
    assert.deepEqual(diary.map(l => l.kind), ['start', 'said', 'result', 'ended', 'start', 'said', 'result', 'ended'])
    assert.deepEqual(diary.filter(l => l.kind === 'start').map(l => l['prompt']), ['/work-queue', 'one more thing'])
    assert.equal((await findRun(repo, outcome.id))?.status, 'done')
  } finally {
    await removeRepo(repo)
  }
})

test('a signal that comes while the run records and reclaims is ignored: the run ends as it ended', async () => {
  const repo = await testRepo()
  try {
    // Without its handler, this signal would end this test's own process.
    const gh = async () => {
      process.kill(process.pid, 'SIGINT')
      await new Promise(resolve => setTimeout(resolve, 50))
      return '[]'
    }
    const outcome = await runCommand(repo, { prompt: '/work-queue', model: 'opus', driver: new FakeDriver({ turns: [{ text: 'Done.' }] }), now: () => NOW, gh })
    assert.equal(outcome.status, 'done')
    assert.deepEqual(outcome.checkout, { reclaimed: true })
    assert.equal((await findRun(repo, outcome.id))?.status, 'done')
  } finally {
    await removeRepo(repo)
  }
})

test('a resume waits while another process of the run holds its lock, then reads the run as that one left it', async () => {
  const repo = await testRepo()
  try {
    const first = await runCommand(repo, { prompt: '/work-queue', model: 'opus', driver: new FakeDriver({ turns: [{ text: QUESTION }], sessionId: 's-ask' }), now: () => NOW, gh: async () => '[]' })
    assert.equal(first.status, 'waiting')
    // The run's own process, or an earlier resume, still at work.
    const alive = new Set([777])
    await acquireRunLock(repo, first.id, { pid: 777, isAlive: pid => alive.has(pid) })
    let started = false
    const finishing: Driver = { id: 'fake', start: async opts => ((started = true), new FakeDriver({ turns: [{ text: 'Shipped.' }] }).start(opts)) }
    const resuming = resumeRun(repo, { id: first.id, answer: 'Approve', driver: finishing, pid: 778, isAlive: pid => alive.has(pid), now: () => NOW, gh: async () => '[]' })
    await new Promise(resolve => setTimeout(resolve, 1200))
    assert.equal(started, false, 'the resume waits for the holder')
    assert.equal((await findRun(repo, first.id))?.status, 'waiting')
    await releaseRunLock(repo, first.id, 777)
    const second = await resuming
    assert.equal(started, true)
    assert.equal(second.status, 'done')
  } finally {
    await removeRepo(repo)
  }
})
