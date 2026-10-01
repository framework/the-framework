import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { logCardFile } from 'agent-driver'
import { addWorktree, agentBranchName, worktreePath } from '@gemstack/skill-branches'
import { formatRunCard, type AnyDiaryLine, type RunCard, type RunStatus } from '@gemstack/skill-logs'
import { liveDir, markerCard, recordRun, type RunnerMark } from 'agent-runner'
import { runCli } from './cli.js'
import { SUBAGENT_LINES, type SubagentDeps } from './subagents.js'
import { git, removeRepo, testRepo } from './test-repo.js'

const HOST = 'this-machine'
const MAIN = '2026-10-01T10-00-00-000Z'
const FIRST = '2026-10-01T10-01-00-000Z'
const SECOND = '2026-10-01T10-02-00-000Z'
const OTHERS = '2026-10-01T10-03-00-000Z'

interface Ran {
  code: number
  out: any
  err: string
}

type Started = Parameters<SubagentDeps['spawn']>[1]

/** The command as the run `agent` calls it from `cwd`, at a fixed time, with a spawn that keeps what it was asked and a stop that keeps the pid. */
async function run(cwd: string, agent: string | undefined, argv: string[], given: Partial<SubagentDeps> = {}): Promise<Ran & { started: Started[]; stopped: number[] }> {
  const outLines: string[] = []
  const errLines: string[] = []
  const started: Started[] = []
  const stopped: number[] = []
  const deps: Partial<SubagentDeps> = {
    host: HOST,
    isAlive: () => true,
    stop: pid => void stopped.push(pid),
    ready: async () => ({ problems: [], warnings: [] }),
    now: () => new Date('2026-10-01T10:01:00.000Z'),
    spawn: async (_repo, run) => void started.push(run),
    ...given,
  }
  const code = await runCli(argv, { cwd, env: agent !== undefined ? { AGENT_ID: agent } : {}, stdout: line => outLines.push(line), stderr: line => errLines.push(line) }, deps)
  return { code, out: outLines.length ? JSON.parse(outLines.join('\n')) : undefined, err: errLines.join('\n'), started, stopped }
}

/** A run's record on the data branch. */
async function record(repo: string, id: string, opts: { status?: RunStatus; prompt?: string; driver?: string; mark?: Partial<RunnerMark>; diary?: AnyDiaryLine[]; branch?: string } = {}): Promise<RunCard> {
  const marker = markerCard({ id, startedAt: '2026-10-01T10:00:00.000Z', prompt: opts.prompt ?? 'Do the work', driver: opts.driver ?? 'claude-code', mark: { host: HOST, ...opts.mark } })
  const card: RunCard = { ...marker, status: opts.status ?? 'running', ...(opts.branch !== undefined ? { branch: opts.branch } : {}) }
  const written = await recordRun(repo, card, opts.diary ?? [])
  assert.ok(written.ok || written.committed, 'the record is written')
  return card
}

/** The main agent: its record, and its checkout on its own branch. */
async function mainAgent(repo: string, opts: { driver?: string; mark?: Partial<RunnerMark> } = {}): Promise<string> {
  await record(repo, MAIN, opts)
  return (await addWorktree(repo, { agentId: MAIN, branch: agentBranchName(MAIN) }, git)).path
}

/** A run's live card in its checkout, as the session keeps it while the agent works. */
async function liveCard(repo: string, card: RunCard): Promise<void> {
  const dir = liveDir(worktreePath(repo, card.id))
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, logCardFile(card.id)), formatRunCard(card))
}

test('start: a run for the caller, from the caller\'s branch, on the caller\'s coding agent, told it is a subagent', async () => {
  const repo = await testRepo()
  try {
    const checkout = await mainAgent(repo, { driver: 'codex' })
    const plain = await run(checkout, MAIN, ['start', 'Add the tests'])
    assert.deepEqual([plain.code, plain.out, plain.err], [0, { ok: true, id: FIRST, driver: 'codex', base: agentBranchName(MAIN) }, ''])
    assert.deepEqual(plain.started, [{ id: FIRST, prompt: `Add the tests\n\n${SUBAGENT_LINES}`, parent: MAIN, base: agentBranchName(MAIN), driver: 'codex' }])
    // Its record is there before its process is: the id answered is one the other commands know.
    assert.deepEqual((await run(checkout, MAIN, ['list'])).out, [{ id: FIRST, startedAt: '2026-10-01T10:01:00.000Z', status: 'running', intent: 'Add the tests', driver: 'codex' }])
    assert.equal((await run(checkout, MAIN, ['stop', FIRST])).out.reason, 'no-process')

    // The coding agent and the model named win; the branch is the one the checkout is on now.
    await git(['branch', '-m', 'split-the-work'], checkout)
    const named = await run(checkout, MAIN, ['start', 'Add the docs', '--driver', 'claude-code', '--model', 'haiku'], { now: () => new Date('2026-10-01T10:02:00.000Z') })
    assert.deepEqual(named.out, { ok: true, id: SECOND, driver: 'claude-code', model: 'haiku', base: 'split-the-work' })
    assert.deepEqual(named.started, [{ id: SECOND, prompt: `Add the docs\n\n${SUBAGENT_LINES}`, parent: MAIN, base: 'split-the-work', driver: 'claude-code', model: 'haiku' }])
    assert.deepEqual((await run(checkout, MAIN, ['read', SECOND])).out.model, 'haiku')

    // Uncommitted work is not on the branch the subagent starts from: said, and the subagent still starts.
    await writeFile(join(checkout, 'draft.md'), 'not committed\n')
    const dirty = await run(checkout, MAIN, ['start', 'Read the draft'], { now: () => new Date('2026-10-01T10:03:00.000Z') })
    assert.deepEqual([dirty.code, dirty.out.uncommitted, dirty.started.length], [0, true, 1])
    assert.match(dirty.err, /uncommitted changes: the subagent does not have them/)

    // A process that cannot be spawned leaves no record saying a subagent runs.
    const unspawned = await run(checkout, MAIN, ['start', 'Never starts'], {
      now: () => new Date('2026-10-01T10:04:00.000Z'),
      spawn: async () => {
        throw new Error('spawn ENOENT')
      },
    })
    assert.deepEqual([unspawned.code, unspawned.out], [1, { ok: false, reason: 'failed', detail: 'spawn ENOENT' }])
    assert.deepEqual((await run(checkout, MAIN, ['list'])).out.map((card: { id: string }) => card.id), [OTHERS, SECOND, FIRST])
  } finally {
    await removeRepo(repo)
  }
})

test('start is refused for a caller that is no run, for a subagent, and when the coding agent cannot start', async () => {
  const repo = await testRepo()
  try {
    const none = await run(repo, undefined, ['start', 'Add the tests'])
    assert.deepEqual([none.code, none.out, none.started], [1, { ok: false, reason: 'not-a-run' }, []])
    assert.match(none.err, /AGENT_ID is not set/)
    const unknown = await run(repo, MAIN, ['start', 'Add the tests'])
    assert.deepEqual([unknown.code, unknown.out, unknown.started], [1, { ok: false, reason: 'not-a-run', id: MAIN }, []])
    assert.match(unknown.err, /do the task yourself/)

    // A main agent whose first record has not reached the branch yet is known by its live card; a
    // coding agent the runner cannot start is not passed on.
    const early = (await addWorktree(repo, { agentId: OTHERS, branch: agentBranchName(OTHERS) }, git)).path
    await liveCard(repo, { ...markerCard({ id: OTHERS, startedAt: '2026-10-01T10:03:00.000Z', prompt: 'Split it', driver: 'pi', mark: { host: HOST, pid: 1 } }) })
    const fromLive = await run(early, OTHERS, ['start', 'Add the tests'])
    assert.deepEqual([fromLive.code, fromLive.started.map(s => [s.parent, s.driver])], [0, [[OTHERS, 'claude-code']]])

    const checkout = await mainAgent(repo)
    const notReady = await run(checkout, MAIN, ['start', 'Add the tests'], { ready: async () => ({ problems: ['claude is not logged in.'], warnings: [] }) })
    assert.deepEqual([notReady.code, notReady.out, notReady.started], [1, { ok: false, reason: 'not-ready', problems: ['claude is not logged in.'], warnings: [] }, []])
    assert.equal(notReady.err, 'claude is not logged in.')

    await git(['checkout', '-q', '--detach'], checkout)
    const detached = await run(checkout, MAIN, ['start', 'Add the tests'])
    assert.deepEqual([detached.code, detached.out.reason, detached.started], [1, 'no-branch', []])

    // A run whose directory is no checkout of its own never borrows the project's branch.
    await record(repo, SECOND)
    await mkdir(liveDir(worktreePath(repo, SECOND)), { recursive: true })
    const noCheckout = await run(repo, SECOND, ['start', 'Add the tests'])
    assert.deepEqual([noCheckout.out.reason, noCheckout.started], ['no-branch', []])

    // A run started for another run starts none of its own.
    await record(repo, FIRST, { mark: { parent: MAIN } })
    await addWorktree(repo, { agentId: FIRST, branch: agentBranchName(FIRST) }, git)
    const nested = await run(checkout, FIRST, ['start', 'Add the tests'])
    assert.deepEqual([nested.code, nested.out, nested.started], [1, { ok: false, reason: 'subagent' }, []])
  } finally {
    await removeRepo(repo)
  }
})

test('list: the caller\'s subagents only, newest first, the task without the added lines, nothing of the runner\'s', async () => {
  const repo = await testRepo()
  try {
    await record(repo, MAIN)
    assert.deepEqual((await run(repo, MAIN, ['list'])).out, [])
    await record(repo, FIRST, { status: 'done', prompt: `Add the tests\n\n${SUBAGENT_LINES}`, mark: { parent: MAIN }, branch: 'tests' })
    await record(repo, SECOND, { prompt: `Add the docs\n\n${SUBAGENT_LINES}`, mark: { parent: MAIN, pid: 4242 } })
    await record(repo, OTHERS, { mark: { parent: FIRST } })
    const listed = await run(repo, MAIN, ['list'])
    assert.equal(listed.code, 0)
    assert.deepEqual(listed.out, [
      { id: SECOND, startedAt: '2026-10-01T10:00:00.000Z', status: 'running', intent: 'Add the docs', driver: 'claude-code' },
      { id: FIRST, startedAt: '2026-10-01T10:00:00.000Z', status: 'done', intent: 'Add the tests', driver: 'claude-code', branch: 'tests' },
    ])
    assert.equal((await run(repo, undefined, ['list'])).out.reason, 'not-a-run')
  } finally {
    await removeRepo(repo)
  }
})

test('read: one subagent with its last reply; a run that is not the caller\'s subagent is refused', async () => {
  const repo = await testRepo()
  try {
    await record(repo, MAIN)
    await record(repo, FIRST, {
      status: 'done',
      prompt: `Add the tests\n\n${SUBAGENT_LINES}`,
      mark: { parent: MAIN },
      branch: 'tests',
      diary: [{ kind: 'result', text: 'Looking.' }, { kind: 'said', text: 'Writing them.' }, { kind: 'result', text: 'Three tests added.' }, { kind: 'ended', status: 'done' }],
    })
    await record(repo, SECOND, { mark: { parent: MAIN } })
    await record(repo, OTHERS, { mark: { parent: FIRST } })
    const done = await run(repo, MAIN, ['read', FIRST])
    assert.deepEqual([done.code, done.out], [0, { ok: true, id: FIRST, startedAt: '2026-10-01T10:00:00.000Z', status: 'done', intent: 'Add the tests', driver: 'claude-code', branch: 'tests', result: 'Three tests added.' }])
    const running = await run(repo, MAIN, ['read', SECOND])
    assert.deepEqual([running.out.status, 'result' in running.out], ['running', false])
    for (const id of [OTHERS, MAIN, '2026-10-01T11-00-00-000Z']) {
      const refused = await run(repo, MAIN, ['read', id])
      assert.deepEqual([refused.code, refused.out], [1, { ok: false, reason: 'not-yours', id }])
    }
  } finally {
    await removeRepo(repo)
  }
})

test('stop: the signal goes to the process on the subagent\'s live card, and only to a subagent running here', async () => {
  const repo = await testRepo()
  try {
    await record(repo, MAIN)
    const running = await record(repo, FIRST, { mark: { parent: MAIN } })
    // No live card yet: the run's process is still starting.
    const starting = await run(repo, MAIN, ['stop', FIRST])
    assert.deepEqual([starting.code, starting.out, starting.stopped], [1, { ok: false, reason: 'no-process', id: FIRST }, []])

    await liveCard(repo, { ...running, caller: { runner: { host: HOST, pid: 4242, parent: MAIN } } })
    const dead = await run(repo, MAIN, ['stop', FIRST], { isAlive: () => false })
    assert.deepEqual([dead.out.reason, dead.stopped], ['no-process', []])
    // A live card that says ended names a pid that is no longer the run's.
    await liveCard(repo, { ...running, status: 'done', caller: { runner: { host: HOST, pid: 4242, parent: MAIN } } })
    assert.deepEqual((await run(repo, MAIN, ['stop', FIRST])).stopped, [])
    await liveCard(repo, { ...running, caller: { runner: { host: HOST, pid: 4242, parent: MAIN } } })
    const stopped = await run(repo, MAIN, ['stop', FIRST])
    assert.deepEqual([stopped.code, stopped.out, stopped.stopped], [0, { ok: true, id: FIRST }, [4242]])

    await record(repo, SECOND, { status: 'done', mark: { parent: MAIN } })
    const ended = await run(repo, MAIN, ['stop', SECOND])
    assert.deepEqual([ended.code, ended.out, ended.stopped], [1, { ok: false, reason: 'not-running', id: SECOND, status: 'done' }, []])

    const elsewhere = await run(repo, MAIN, ['stop', FIRST], { host: 'another-machine' })
    assert.deepEqual([elsewhere.out, elsewhere.stopped], [{ ok: false, reason: 'other-machine', id: FIRST }, []])

    await record(repo, OTHERS, { mark: { parent: SECOND } })
    await liveCard(repo, { ...running, id: OTHERS, caller: { runner: { host: HOST, pid: 777, parent: SECOND } } })
    const notMine = await run(repo, MAIN, ['stop', OTHERS])
    assert.deepEqual([notMine.out, notMine.stopped], [{ ok: false, reason: 'not-yours', id: OTHERS }, []])
  } finally {
    await removeRepo(repo)
  }
})

test('a command line that cannot be read exits 2 with the usage and starts nothing; outside a repository is a refusal', async () => {
  const repo = await testRepo()
  const elsewhere = await mkdtemp(join(tmpdir(), 'not-a-repo-'))
  try {
    await mainAgent(repo)
    for (const argv of [[], ['nope'], ['start'], ['start', ' '], ['start', 'a', 'b'], ['start', 'a', '--driver', 'pi'], ['list', 'extra'], ['read'], ['stop'], ['stop', FIRST, '--force']]) {
      const bad = await run(repo, MAIN, argv)
      assert.deepEqual([bad.code, bad.out, bad.started, bad.stopped], [2, undefined, [], []], argv.join(' '))
      assert.match(bad.err, /usage: orchestration/)
    }
    const outside = await run(elsewhere, MAIN, ['list'])
    assert.deepEqual([outside.code, outside.out], [1, { ok: false, reason: 'not-a-repo' }])
  } finally {
    await removeRepo(repo)
    await rm(elsewhere, { recursive: true, force: true })
  }
})
