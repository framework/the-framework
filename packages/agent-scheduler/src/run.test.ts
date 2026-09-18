import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { appendInbox, FakeDriver, type Driver, type DriverSession, type DriverStartOptions, type FakeDriverSession } from 'agent-driver'
import { MERGE_HELD_NOTE, mergeHeld, publishCheckout, worktreePath } from '@gemstack/skill-branches'
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

/** A clock a minute on at every reading: two runs of one process get two ids. */
function ticking(): () => Date {
  let minutes = 0
  return () => new Date(NOW.getTime() + minutes++ * 60_000)
}

/** A gh holding one pull request for one branch: opened by the agent's publish, read back by the run, released at the end. */
function prGh(branch: string): { gh: (args: string[]) => Promise<string>; calls: string[][]; body: () => string } {
  const calls: string[][] = []
  let opened = false
  let body = ''
  const url = 'https://github.com/x/y/pull/12'
  const gh = async (args: string[]): Promise<string> => {
    calls.push(args)
    if (args[1] === 'list') return JSON.stringify(opened && args.includes(branch) ? [{ number: 12, url }] : [])
    if (args[1] === 'create') {
      opened = true
      body = args[args.indexOf('--body') + 1]!
      return `${url}\n`
    }
    if (args[1] === 'view') return JSON.stringify({ state: 'OPEN', body })
    if (args[1] === 'edit') {
      body = args[args.indexOf('--body') + 1]!
      return ''
    }
    if (args[1] === 'merge') return ''
    throw new Error(`unexpected gh ${args.join(' ')}`)
  }
  return { gh, calls, body: () => body }
}

/** An agent that commits a file on the branch it names and publishes with --merge, the way the branches skill says; it notes whether its checkout was held. */
function publishingDriver(gh: (args: string[]) => Promise<string>, seen: { held?: boolean }): Driver {
  return {
    id: 'fake',
    start: async (opts: DriverStartOptions): Promise<DriverSession> => {
      const fake = await new FakeDriver({ turns: [{ text: 'Fixed it and published.' }], sessionId: 's-1' }).start(opts)
      return wrap(fake, async () => {
        seen.held = await mergeHeld(opts.cwd, git)
        await git(['config', 'user.email', 'agent@example.com'], opts.cwd)
        await git(['config', 'user.name', 'agent'], opts.cwd)
        await git(['branch', '-m', 'agent-fix-it'], opts.cwd)
        await writeFile(join(opts.cwd, 'fixed.txt'), 'fixed\n')
        await git(['add', '-A'], opts.cwd)
        await git(['commit', '-q', '-m', 'Fix it'], opts.cwd)
        const published = await publishCheckout(opts.cwd, { title: 'Fix it', body: 'Fixed.', merge: true, gh })
        assert.ok(published.ok)
      })
    },
  }
}

test('a run with a follow-up: its merge is held, a fresh agent works its branch with the run\'s id, and the merge is released once that one ends done', async () => {
  const repo = await testRepo()
  try {
    const { gh, calls, body } = prGh('agent-fix-it')
    const seen: { held?: boolean } = {}
    const next: { prompt?: string; cwd?: string; branch?: string; held?: boolean; mergedBefore?: boolean } = {}
    const cleanup: Driver = {
      id: 'fake',
      start: async opts => {
        const fake = await new FakeDriver({ turns: [{ text: 'Cleaned up.' }], sessionId: 's-2' }).start(opts)
        return wrap(fake, async text => {
          next.prompt = text
          next.cwd = opts.cwd
          next.branch = (await git(['branch', '--show-current'], opts.cwd)).trim()
          next.held = await mergeHeld(opts.cwd, git)
          next.mergedBefore = calls.some(c => c[1] === 'merge')
          await git(['config', 'user.email', 'agent@example.com'], opts.cwd)
          await git(['config', 'user.name', 'agent'], opts.cwd)
          await writeFile(join(opts.cwd, 'FACTS.md'), 'a fact\n')
          await git(['add', '-A'], opts.cwd)
          await git(['commit', '-q', '-m', 'Knowledge'], opts.cwd)
          assert.ok((await publishCheckout(opts.cwd, { title: 'ignored', gh })).ok)
        })
      },
    }
    const nextIds: string[] = []
    const outcome = await runCommand(repo, {
      prompt: '/work-queue',
      then: '/post-merge-cleanup',
      driver: publishingDriver(gh, seen),
      nextDriver: id => (nextIds.push(id), cleanup),
      host: 'this-box',
      pid: 4242,
      now: ticking(),
      gh,
    })

    assert.equal(seen.held, true, 'the first agent worked under the hold')
    assert.equal(outcome.status, 'done')
    assert.deepEqual(outcome.pr, { number: 12, url: 'https://github.com/x/y/pull/12' })
    assert.deepEqual((await findRun(repo, outcome.id))?.caller?.['scheduler'], { command: 'work-queue', host: 'this-box', pid: 4242, then: '/post-merge-cleanup' })

    const then = outcome.then!
    assert.notEqual(then.id, outcome.id, 'a fresh agent: a run of its own')
    assert.deepEqual(nextIds, [then.id], 'on the coding agent made for its own id')
    assert.equal(next.prompt, `/post-merge-cleanup ${outcome.id}`)
    assert.equal(next.cwd, worktreePath(repo, then.id))
    assert.equal(next.branch, 'agent-fix-it', 'on the first run\'s branch')
    assert.equal(next.held, false, 'the follow-up is the last: nothing holds it')
    assert.equal(next.mergedBefore, false, 'nothing merged while the follow-up worked')
    assert.equal(then.status, 'done')
    assert.deepEqual(then.merge, { outcome: 'auto-armed' })
    assert.deepEqual(calls.filter(c => c[1] === 'merge'), [['pr', 'merge', '12', '--squash', '--auto']])
    assert.equal(body(), 'Fixed.', 'the held line left the body')
    assert.deepEqual(then.checkout, { reclaimed: true })

    const recorded = await findRun(repo, then.id)
    assert.equal(recorded?.status, 'done')
    assert.equal(recorded?.intent, `/post-merge-cleanup ${outcome.id}`)
    assert.deepEqual(recorded?.caller?.['scheduler'], { command: 'post-merge-cleanup', host: 'this-box', pid: 4242 })
    assert.equal((await git(['rev-parse', 'refs/remotes/origin/agent-fix-it'], repo)).trim(), (await git(['rev-parse', 'agent-fix-it'], repo)).trim(), 'the follow-up\'s commit is on the same branch, pushed')
  } finally {
    await removeRepo(repo)
  }
})

test('a follow-up that fails leaves the merge held and the request saying so; a run that opened no request has no follow-up', async () => {
  const repo = await testRepo()
  try {
    const { gh, calls, body } = prGh('agent-fix-it')
    const failing: Driver = { id: 'fake', start: async () => Promise.reject(new Error('the CLI is gone')) }
    const outcome = await runCommand(repo, { prompt: '/work-queue', then: '/post-merge-cleanup', driver: publishingDriver(gh, {}), nextDriver: () => failing, now: ticking(), gh })
    assert.equal(outcome.status, 'done')
    assert.equal(outcome.then?.status, 'failed')
    assert.equal(outcome.then?.merge, undefined)
    assert.deepEqual(calls.filter(c => c[1] === 'merge'), [], 'nothing armed')
    assert.equal(body(), `Fixed.\n\n${MERGE_HELD_NOTE}`)

    let started = false
    const quiet = await runCommand(repo, { prompt: '/work-queue', then: '/post-merge-cleanup', driver: new FakeDriver({ turns: [{ text: 'Nothing to do.' }] }), nextDriver: () => ((started = true), failing), now: ticking(), gh: async () => '[]' })
    assert.equal(quiet.status, 'done')
    assert.equal(quiet.then, undefined)
    assert.equal(started, false)
  } finally {
    await removeRepo(repo)
  }
})

test('a run with a follow-up that ends waiting keeps its hold; the answer resumes it, and the follow-up runs once it ends done', async () => {
  const repo = await testRepo()
  try {
    const { gh, calls } = prGh('agent-fix-it')
    const asking = new FakeDriver({ turns: [{ text: QUESTION }], sessionId: 's-ask' })
    const first = await runCommand(repo, { prompt: '/plan', then: '/post-merge-cleanup', driver: asking, now: ticking(), gh })
    assert.equal(first.status, 'waiting')
    assert.equal(first.then, undefined)
    assert.equal(await mergeHeld(worktreePath(repo, first.id), git), true)

    const prompts: string[] = []
    const cleanup: Driver = { id: 'fake', start: async opts => wrap(await new FakeDriver({ turns: [{ text: 'Cleaned up.' }] }).start(opts), async text => void prompts.push(text)) }
    const seen: { held?: boolean } = {}
    const resumed = await resumeRun(repo, { id: first.id, answer: 'Approve', driver: publishingDriver(gh, seen), nextDriver: () => cleanup, now: ticking(), gh })
    assert.equal(seen.held, true, 'the resumed run is still held')
    assert.equal(resumed.status, 'done')
    assert.equal(resumed.then?.status, 'done')
    assert.deepEqual(prompts, [`/post-merge-cleanup ${first.id}`])
    assert.deepEqual(resumed.then?.merge, { outcome: 'auto-armed' })
    assert.equal(calls.filter(c => c[1] === 'merge').length, 1)
  } finally {
    await removeRepo(repo)
  }
})

test('a run with a follow-up continued after its checkout went is held again in the new one, and its follow-up runs once it ends done', async () => {
  const repo = await testRepo()
  try {
    const { gh, calls } = prGh('agent-fix-it')
    const first = await runCommand(repo, { prompt: '/work-queue', then: '/post-merge-cleanup', driver: new FakeDriver({ turns: [{ text: 'Nothing to publish yet.' }], sessionId: 's-1' }), now: ticking(), gh })
    assert.equal(first.status, 'done')
    assert.equal(first.then, undefined, 'no pull request, no follow-up')
    assert.deepEqual(first.checkout, { reclaimed: true })

    const seen: { held?: boolean } = {}
    const prompts: string[] = []
    const cleanup: Driver = { id: 'fake', start: async opts => wrap(await new FakeDriver({ turns: [{ text: 'Cleaned up.' }] }).start(opts), async text => void prompts.push(text)) }
    const continued = await resumeRun(repo, { id: first.id, text: 'Publish it now.', driver: publishingDriver(gh, seen), nextDriver: () => cleanup, now: ticking(), gh })
    assert.equal(seen.held, true, 'the new checkout is under the hold')
    assert.equal(continued.status, 'done')
    assert.deepEqual(prompts, [`/post-merge-cleanup ${first.id}`])
    assert.deepEqual(continued.then?.merge, { outcome: 'auto-armed' })
    assert.equal(calls.filter(c => c[1] === 'merge').length, 1, 'armed once, after the follow-up')
  } finally {
    await removeRepo(repo)
  }
})
