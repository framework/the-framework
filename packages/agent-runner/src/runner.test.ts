import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { findRun } from '@gemstack/skill-logs'
import { FakeDriver, type Driver } from 'agent-driver'
import { ClaudeCodeDriver } from '@agent-driver/claude'
import { CodexDriver } from '@agent-driver/codex'
import { runCommand } from './run.js'
import { detachResume, detachRun, driverFor, readyToRun, resumeArgs, resumeProject, runArgs } from './runner.js'
import { removeRepo, testRepo } from './test-repo.js'

// The detached start, with the spawn faked: the marker on the branch, the process asked for, the id answered.

const NOW = new Date('2026-09-17T20:00:00.000Z')

test('run --detach writes the marker, spawns the run with its id, and answers the id at once', async () => {
  const repo = await testRepo()
  try {
    const spawned: unknown[] = []
    const started = await detachRun(repo, { prompt: '/work-queue now', now: () => NOW }, { spawn: async (_repo, run) => { spawned.push(run) }, host: 'this-box' })
    assert.deepEqual(started, { id: '2026-09-17T20-00-00-000Z', driver: 'claude-code' }, 'no model given: the coding agent starts on its own default')
    assert.deepEqual(spawned, [{ id: started.id, prompt: '/work-queue now', driver: 'claude-code' }])
    const card = await findRun(repo, started.id)
    assert.equal(card?.status, 'running', 'the marker says the run is in flight from now on')
    assert.equal(card?.intent, '/work-queue now')
    assert.equal(card?.model, undefined)
    assert.deepEqual(card?.caller?.['runner'], { host: 'this-box' }, 'no pid yet: the process does not exist')
    const named = await detachRun(repo, { prompt: 'Read the docs', model: 'opus', now: () => new Date(NOW.getTime() + 1000) }, { spawn: async () => {}, host: 'this-box' })
    assert.equal(named.model, 'opus')
    assert.equal((await findRun(repo, named.id))?.model, 'opus')
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

test('run --detach on Codex: the marker and the spawned run name Codex, and no model unless one is given', async () => {
  const repo = await testRepo()
  try {
    const spawned: unknown[] = []
    const started = await detachRun(repo, { prompt: '/work-queue', driver: 'codex', now: () => NOW }, { spawn: async (_repo, run) => { spawned.push(run) }, host: 'this-box' })
    assert.deepEqual(started, { id: '2026-09-17T20-00-00-000Z', driver: 'codex' })
    assert.deepEqual(spawned, [{ id: started.id, prompt: '/work-queue', driver: 'codex' }])
    const card = await findRun(repo, started.id)
    assert.equal(card?.driver, 'codex')
    assert.equal(card?.model, undefined)
    const named = await detachRun(repo, { prompt: '/work-queue', driver: 'codex', model: 'gpt-5', now: () => new Date(NOW.getTime() + 1000) }, { spawn: async () => {}, host: 'this-box' })
    assert.equal(named.model, 'gpt-5', 'a model given by hand is passed on')
    const followed: unknown[] = []
    const withThen = await detachRun(repo, { prompt: '/work-queue', driver: 'codex', then: '/post-merge-cleanup', now: () => new Date(NOW.getTime() + 2000) }, { spawn: async (_repo, run) => { followed.push(run) }, host: 'this-box' })
    assert.deepEqual(followed, [{ id: withThen.id, prompt: '/work-queue', driver: 'codex', then: '/post-merge-cleanup' }])
    assert.deepEqual((await findRun(repo, withThen.id))?.caller?.['runner'], { host: 'this-box', then: '/post-merge-cleanup' }, 'the follow-up is on the record from the start')
  } finally {
    await removeRepo(repo)
  }
})

test('a run\'s coding agent is unrestricted, has the run\'s id, and gets this machine\'s setup parts as they are', () => {
  const personal = { memory: true, connectors: false, skills: false }
  const optsOf = (driver: Driver) => (driver as unknown as { opts: { sandbox?: string; permissionMode?: string; env?: NodeJS.ProcessEnv; personal?: unknown } }).opts
  const codex = driverFor('codex', 'run-1', personal)
  assert.ok(codex instanceof CodexDriver)
  assert.equal(optsOf(codex).sandbox, 'danger-full-access')
  assert.equal(optsOf(codex).env?.['AGENT_ID'], 'run-1')
  assert.deepEqual(optsOf(codex).personal, personal)
  const claude = driverFor('claude-code', 'run-1', personal)
  assert.ok(claude instanceof ClaudeCodeDriver)
  assert.equal(optsOf(claude).permissionMode, 'bypassPermissions')
  assert.equal(optsOf(claude).env?.['AGENT_ID'], 'run-1')
  assert.deepEqual(optsOf(claude).personal, personal)
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
    const first = await runCommand(repo, { prompt: 'Read the docs', driver: codex('Read.'), host: 'this-box', pid: 4242, now: () => NOW, gitHost: { requestOfBranch: async () => undefined, mergeRequest: async () => ({ outcome: 'failed', error: 'none' }) } })
    assert.equal(first.status, 'done')
    const asked: string[] = []
    const second = await resumeProject(repo, { id: first.id, text: 'And the tests?' }, { driverFor: (name, _id, setup) => { asked.push(`${name} ${JSON.stringify(setup)}`); return codex('Read too.') } })
    assert.equal(second.status, 'done')
    assert.deepEqual(asked, ['codex {"memory":true,"connectors":true,"skills":true}'], 'no config on this machine: the run loads the person\'s setup')
    assert.deepEqual(startedWith, [{}, {}], 'no model named at the start nor at the resume: Codex runs on its own default')
  } finally {
    await removeRepo(repo)
  }
})

test('a spawned run is told its tool, and its model only when it has one', () => {
  assert.deepEqual(runArgs({ id: 'r1', prompt: '/work-queue', model: 'opus' }), ['run', '/work-queue', '--id', 'r1', '--model', 'opus'])
  assert.deepEqual(runArgs({ id: 'r1', prompt: '/work-queue', driver: 'codex' }), ['run', '/work-queue', '--id', 'r1', '--driver', 'codex'])
  assert.deepEqual(runArgs({ id: 'r1', prompt: '/work-queue', then: '/post-merge-cleanup' }), ['run', '/work-queue', '--id', 'r1', '--then', '/post-merge-cleanup'])
})

test('ready to run: the coding agent\'s problems stop a run; nothing else is probed, the git host least of all', async () => {
  const notRoot = () => false
  const probed: string[] = []
  const answers = (loggedIn: boolean) => async (bin: string, args: readonly string[]) => {
    probed.push(bin)
    return { ok: true, output: args[0] === '--version' ? '2.1.0' : JSON.stringify({ loggedIn }) }
  }
  const repo = await testRepo()
  try {
    assert.deepEqual(await readyToRun(repo, 'claude-code', { probe: answers(true), isRoot: notRoot }), { problems: [], warnings: [] })
    assert.deepEqual(await readyToRun(repo, 'codex', { probe: answers(true), isRoot: notRoot, agentsSkills: join(repo, 'no-such-dir') }), { problems: [], warnings: [] })
    assert.ok(probed.every(bin => bin === 'claude' || bin === 'codex'), `only the coding agent's CLI is asked, not ${probed.join(', ')}`)

    const out = await readyToRun(repo, 'claude-code', { probe: answers(false), isRoot: notRoot })
    assert.match(out.problems[0]!, /claude auth login/)
  } finally {
    await removeRepo(repo)
  }
})

test('ready to run on Codex: skills in ~/.agents/skills are no warning while runs load the person\'s skills, and a warning once this machine turns them off', async () => {
  const repo = await testRepo()
  try {
    const agentsSkills = join(repo, 'agents-skills')
    await mkdir(join(agentsSkills, 'my-skill'), { recursive: true })
    const deps = { probe: async (_bin: string, args: readonly string[]) => ({ ok: true, output: args[0] === '--version' ? '0.144.4' : 'Logged in' }), isRoot: () => false, agentsSkills }
    assert.deepEqual(await readyToRun(repo, 'codex', deps), { problems: [], warnings: [] })
    await mkdir(join(repo, '.agent-runner'), { recursive: true })
    await writeFile(join(repo, '.agent-runner', 'config.yml'), 'personal:\n  skills: off\n')
    const out = await readyToRun(repo, 'codex', deps)
    assert.deepEqual(out.problems, [])
    assert.match(out.warnings[0]!, /no switch/)
  } finally {
    await removeRepo(repo)
  }
})
