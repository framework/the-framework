import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readdir, readFile, rm, stat, realpath } from 'node:fs/promises'
import { join, delimiter } from 'node:path'
import { execFile } from 'node:child_process'
import { tmpdir } from 'node:os'
import { createProjectRuntime, cleanupTimedOutWorktree, markFailedStart, agentStderrPath, isTransientAgentFailure, lastAgentFailureDetail, MAX_TRANSIENT_RETRIES } from './daemon-runtime.js'
import type { PreflightResult } from './preflight.js'

/**
 * A ready agent, injected into every start below (#1326). A daemon start now preflights the
 * picked agent's CLI, and these tests are about worktrees and teardown, not about whether the
 * machine running them happens to have `claude` installed and logged in.
 */
const agentReady = (): Promise<PreflightResult> => Promise.resolve({ ok: true, checks: [] })

import { EVENTS_FILE, META_FILE, startedAtFromAgentId, type AgentMeta } from './store/index.js'
import { BRANCHES_DIR, worktreePath, agentBranchName, nodeGitRunner, GitTimeoutError, CLI_BIN_DIR } from '@gemstack/skill-branches'
import { THE_FRAMEWORK_DIR } from './framework-dir.js'
import { addProject, projectId } from './registry.js'
import type { AgentSpec } from './agent-spec.js'

/**
 * Where an agent is allowed to land (#997). An agent gets its own worktree (#736); the pre-#736
 * fallback into the project's own checkout survives only for a project that cannot host one at
 * all. A repo whose `worktree add` failed used to take that same fallback, which pointed the
 * agent at the user's working tree and its uncommitted work.
 */

/**
 * Teardown options for every `rm` in this file. Starts spawn detached, and daemon-side writes
 * (meta, sessions, registry) can still be landing when a teardown begins; a concurrent create
 * inside a dir being removed fails the whole rm with ENOTEMPTY (#1165's teardown-race tail —
 * the body passes, the cleanup flakes, #1398). Retrying absorbs that tail. Half the file already
 * used these options ad hoc; the flake lived in the teardowns that did not.
 */
const RETRIED_RM = { recursive: true, force: true, maxRetries: 10, retryDelay: 100 } as const

/** A stub CLI that records the session spec it was handed, so a start is observable. */
async function writeStub(dir: string, log: string): Promise<string> {
  const stub = join(dir, 'stub-cli.cjs')
  await writeFile(
    stub,
    `const fs = require('node:fs')\n` +
      `const argv = process.argv.slice(2)\n` +
      `fs.appendFileSync(${JSON.stringify(log)}, fs.readFileSync(argv[argv.indexOf('--agent') + 1], 'utf8').replace(/\\s*\\n\\s*/g, '') + '\\n')\n`,
  )
  return stub
}

/**
 * 20ms apart, so 500 attempts is a 10s ceiling. It is a backstop, not a slowness allowance: raising
 * it never fixed anything (6s, then 30s, then 15s all failed the same way, #1153/#1165), because the
 * re-home either lands in well under a second or has gone wrong. The ceiling only has to be small
 * enough that the three waits one re-home test makes still fit inside the suite's 60s per-test
 * timeout (`--test-timeout` in scripts/run-tests.mjs) with the real git work between them — at 30s
 * a single wait reached that cap and turned a clean assertion failure into a file timeout.
 */
const POLL_ATTEMPTS = 500

/** The stub's recorded starts, waited for (a start spawns detached). */
async function startedSpecs(log: string, expected: number): Promise<AgentSpec[]> {
  let lines: string[] = []
  for (let i = 0; i < POLL_ATTEMPTS && lines.length < expected; i++) {
    await new Promise(r => setTimeout(r, 20))
    lines = await readFile(log, 'utf8').then(s => s.split('\n').filter(Boolean), () => [])
  }
  return lines.map(line => JSON.parse(line) as AgentSpec)
}

/** Capture `console.log` for the duration of `body`. */
async function withCapturedLog(body: () => Promise<void>): Promise<string> {
  const original = console.log
  const lines: string[] = []
  console.log = (...args: unknown[]) => void lines.push(args.map(String).join(' '))
  try {
    await body()
  } finally {
    console.log = original
  }
  return lines.join('\n')
}

test('a Start landing after the stop pass is refused, never spawned into the shutdown gap (#983)', async () => {
  // The HTTP surface closes after the agents do, so a Start can arrive mid-shutdown. Spawned, it
  // would be a detached child outside the snapshot stopAgents terminated — an orphan on ppid 1.
  const cwd = await realpath(await mkdtemp(join(tmpdir(), 'framework-closing-')))
  try {
    const log = join(cwd, 'started.log')
    const runtime = createProjectRuntime({ driverPreflight: agentReady, cwd, env: {}, binPath: await writeStub(cwd, log) })
    await runtime.stopAgents()
    const result = (await runtime.onStart('build a thing', 'build')) as { ok: boolean; error?: string }
    assert.equal(result.ok, false)
    assert.match(result.error ?? '', /shutting down/)
    await new Promise(r => setTimeout(r, 250))
    assert.equal(await readFile(log, 'utf8').catch(() => ''), '', 'no run was spawned at all')
    await runtime.dispose()
  } finally {
    await rm(cwd, RETRIED_RM)
  }
})

test('a shutdown refusal takes back the workspace it had already allocated (#983)', async () => {
  // The stop can land between onStart's entry check and its pre-spawn re-check — everything
  // between is awaited. The refusal must return the fresh worktree and branch too: left
  // standing, the worktree has no agent.json, and the next boot's sweep would reclaim it by
  // pushing an empty junk branch. The preflight seam is where this test lands the stop.
  const cwd = await realpath(await mkdtemp(join(tmpdir(), 'framework-closing-alloc-')))
  try {
    const git = nodeGitRunner()
    await git(['init'], cwd)
    await git(['config', 'user.email', 't@t'], cwd)
    await git(['config', 'user.name', 't'], cwd)
    await writeFile(join(cwd, 'README.md'), '# t\n')
    await git(['add', '-A'], cwd)
    await git(['commit', '-m', 'init'], cwd)

    const specHome = join(cwd, 'spec-home')
    await mkdir(specHome, { recursive: true })
    const log = join(cwd, 'started.log')
    const runtime = createProjectRuntime({
      driverPreflight: async () => {
        await runtime.stopAgents()
        return { ok: true, checks: [] }
      },
      cwd,
      env: { FRAMEWORK_SESSION_SPEC_DIR: specHome },
      binPath: await writeStub(cwd, log),
    })
    const result = (await runtime.onStart('build a thing', 'build')) as { ok: boolean; error?: string }
    assert.equal(result.ok, false)
    assert.match(result.error ?? '', /shutting down/)
    assert.deepEqual(await readdir(join(cwd, THE_FRAMEWORK_DIR, BRANCHES_DIR)).catch(() => []), [], 'the worktree is gone')
    assert.equal((await git(['branch', '--list', 'agent-*'], cwd)).trim(), '', 'and so is its branch')
    assert.deepEqual(await readdir(specHome), [], 'and the spec it wrote')
    await runtime.dispose()
  } finally {
    await rm(cwd, RETRIED_RM)
  }
})

test('a child that dies before reading its spec does not leave it on disk (D4)', async () => {
  const cwd = await realpath(await mkdtemp(join(tmpdir(), 'framework-spec-sweep-')))
  try {
    const specHome = join(cwd, 'spec-home')
    await mkdir(specHome, { recursive: true })
    const runtime = createProjectRuntime({
      driverPreflight: agentReady,
      cwd,
      env: { FRAMEWORK_SESSION_SPEC_DIR: specHome },
      binPath: await writeDyingStub(cwd),
    })
    let result: { ok: boolean } | undefined
    await withCapturedLog(async () => {
      result = (await runtime.onStart('build a thing', 'build')) as { ok: boolean }
    })
    assert.equal(result?.ok, true)
    // The stub exits without ever reading its spec; the exit handler removes what it left —
    // the prompt, and any device token the options carried.
    let leftover: string[] = ['unread']
    for (let i = 0; i < POLL_ATTEMPTS && leftover.length > 0; i++) {
      await new Promise(r => setTimeout(r, 20))
      leftover = await readdir(specHome)
    }
    assert.deepEqual(leftover, [])
    await runtime.dispose()
  } finally {
    await rm(cwd, RETRIED_RM)
  }
})

test('a repo whose worktree could not be created fails the run instead of borrowing the checkout (#997)', async () => {
  // realpath: on macOS tmpdir sits under the /var -> /private/var symlink and git reports the
  // resolved path (the same gotcha the worktree round-trip test documents).
  const cwd = await realpath(await mkdtemp(join(tmpdir(), 'framework-alloc-fail-')))
  try {
    const git = nodeGitRunner()
    await git(['init'], cwd)
    await git(['config', 'user.email', 't@t'], cwd)
    await git(['config', 'user.name', 't'], cwd)
    await writeFile(join(cwd, 'README.md'), '# t\n')
    await git(['add', '-A'], cwd)
    await git(['commit', '-m', 'init'], cwd)

    // A *file* where the worktrees directory belongs: git cannot create the leading directories,
    // so `worktree add` rejects. Stands in for the SIGTERM this exists for, which needs a repo big
    // enough to outrun a 120s budget; both arrive here as one rejection from a working git.
    await writeFile(join(cwd, BRANCHES_DIR), '')

    const log = join(cwd, 'started.log')
    const runtime = createProjectRuntime({ driverPreflight: agentReady, cwd, env: {}, binPath: await writeStub(cwd, log) })
    const result = await runtime.onStart('build a thing', 'build')

    assert.equal(result.ok, false, 'the Start is refused rather than downgraded into the main checkout')
    assert.match(result.ok ? '' : result.error, /could not create a worktree for this run/)
    // The real damage the fallback did: an agent editing the user's own working tree.
    assert.deepEqual(await startedSpecs(log, 1), [], 'no run was spawned at all')
    await runtime.dispose()
  } finally {
    await rm(cwd, RETRIED_RM)
  }
})

test('a project that is not a git repo still falls back to the main checkout, and says why (#997)', async () => {
  const cwd = await realpath(await mkdtemp(join(tmpdir(), 'framework-alloc-nogit-')))
  try {
    const log = join(cwd, 'started.log')
    const runtime = createProjectRuntime({ driverPreflight: agentReady, cwd, env: {}, binPath: await writeStub(cwd, log) })
    let result: { ok: boolean; agentId?: string } | undefined
    const logged = await withCapturedLog(async () => {
      result = (await runtime.onStart('build a thing', 'build')) as { ok: boolean; agentId?: string }
    })

    assert.equal(result?.ok, true, 'the pre-#736 fallback is intact for a project with no repo')
    assert.equal(result?.agentId, undefined, 'and is still signalled by the absent agentId')
    const specs = await startedSpecs(log, 1)
    assert.equal(specs.length, 1, 'the run spawned')
    assert.equal(specs[0]!.cwd, cwd, 'in the main checkout')
    assert.equal(specs[0]!.agentId, undefined)
    // The message has to name the reason: "no worktree (<git error>)" read the same whether git
    // was absent or git had failed, which is exactly the distinction that went missing.
    assert.match(logged, /is not a git repository, so it gets no worktree/)
    await runtime.dispose()
  } finally {
    await rm(cwd, RETRIED_RM)
  }
})

/** Write an agent's live meta into a checkout, so a teardown/read has a status to act on. */
async function writeAgentMeta(checkout: string, status: AgentMeta['status'], extra: Partial<AgentMeta> = {}): Promise<void> {
  const dir = join(checkout, THE_FRAMEWORK_DIR)
  await mkdir(dir, { recursive: true })
  const meta: AgentMeta = {
    status,
    id: 'run1',
    startedAt: '2026-07-24T00:00:00.000Z',
    updatedAt: '2026-07-24T00:00:00.000Z',
    ...extra,
  }
  await writeFile(join(dir, 'agent.json'), JSON.stringify(meta))
}

test('a SIGTERMed worktree add has its partial checkout removed, other failures do not (#997)', async () => {
  // Observed against real git: a SIGTERM mid-add leaves the directory it had written and git
  // drops its own administrative entry, so `worktree prune` has nothing to clean.
  const repo = await realpath(await mkdtemp(join(tmpdir(), 'framework-alloc-partial-')))
  try {
    const partial = worktreePath(repo, 'run1')
    const exists = async (): Promise<boolean> => stat(partial).then(() => true, () => false)

    await mkdir(join(partial, 'src'), { recursive: true })
    await cleanupTimedOutWorktree(repo, 'run1', new Error('fatal: invalid reference: HEAD'))
    assert.equal(await exists(), true, 'a plain git rejection leaves the path alone')

    await cleanupTimedOutWorktree(repo, 'run1', new GitTimeoutError(['worktree', 'add'], 120_000))
    assert.equal(await exists(), false, 'a timeout kill takes its half-written checkout with it')
  } finally {
    await rm(repo, RETRIED_RM)
  }
})

/** A committed git repo to re-home an agent into, path realpath'd so it matches what git reports. */
async function initRepo(prefix: string): Promise<string> {
  const repo = await realpath(await mkdtemp(join(tmpdir(), prefix)))
  const git = nodeGitRunner()
  await git(['init'], repo)
  await git(['config', 'user.email', 't@t'], repo)
  await git(['config', 'user.name', 't'], repo)
  await writeFile(join(repo, 'README.md'), '# t\n')
  await git(['add', '-A'], repo)
  await git(['commit', '-m', 'init'], repo)
  return repo
}

/** A stub CLI that prints a boot error to stderr and dies without ever opening its agent store (#1261). */
async function writeDyingStub(dir: string): Promise<string> {
  const stub = join(dir, 'dying-stub.cjs')
  await writeFile(
    stub,
    `process.stderr.write("Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'some-workspace-dep'\\n")\n` + `process.exit(1)\n`,
  )
  return stub
}

/** Poll a checkout until its `agent.json` appears, or time out. */
async function waitForMeta(cwd: string): Promise<AgentMeta | undefined> {
  for (let i = 0; i < POLL_ATTEMPTS; i++) {
    const raw = await readFile(join(cwd, THE_FRAMEWORK_DIR, META_FILE), 'utf8').catch(() => '')
    if (raw) return JSON.parse(raw) as AgentMeta
    await new Promise(r => setTimeout(r, 20))
  }
  return undefined
}

/** Poll a checkout's event log until `pattern` shows up, and return what was read. */
async function waitForLogLine(cwd: string, pattern: RegExp): Promise<string> {
  let events = ''
  for (let i = 0; i < POLL_ATTEMPTS && !pattern.test(events); i++) {
    await new Promise(r => setTimeout(r, 20))
    events = await readFile(join(cwd, THE_FRAMEWORK_DIR, EVENTS_FILE), 'utf8').catch(() => '')
  }
  return events
}

/**
 * Poll the stub's recorded starts until at least `expected` land, or time out.
 *
 * The loop returns the moment the starts land, so the cap only ever costs time on a real failure.
 */
async function waitForSpecs(log: string, expected: number): Promise<AgentSpec[]> {
  let lines: string[] = []
  for (let i = 0; i < POLL_ATTEMPTS && lines.length < expected; i++) {
    await new Promise(r => setTimeout(r, 20))
    lines = await readFile(log, 'utf8').then(s => s.split('\n').filter(Boolean), () => [])
  }
  return lines.map(line => JSON.parse(line) as AgentSpec)
}

/** A stub CLI that stays up until it is told to stop, like a run whose process outlived its work. */
async function writeLingeringStub(dir: string): Promise<string> {
  const stub = join(dir, 'lingering-stub.cjs')
  await writeFile(stub, `process.on('SIGTERM', () => process.exit(0))\nsetInterval(() => {}, 1000)\n`)
  return stub
}

test('a held slot names its run and pid, and the shutdown names what it stopped (#1646)', async () => {
  // The daemon's slot table is the one place a process that outlived its finished run still
  // shows: the Agents panel reads each run's own status. So the reading has to say *which* run
  // holds a slot, or a cap reached by such a process reads as a bug in the count.
  const cwd = await initRepo('framework-slots-')
  const runtime = createProjectRuntime({ driverPreflight: agentReady, cwd, env: {}, binPath: await writeLingeringStub(cwd) })
  try {
    const result = (await runtime.onStart('build a thing', 'build')) as { ok: boolean; agentId?: string }
    assert.equal(result.ok, true)
    const agentId = result.agentId!
    const home = projectId(cwd)
    let slots = runtime.activeAgentSlots(home)
    for (let i = 0; i < POLL_ATTEMPTS && slots.length === 0; i++) {
      await new Promise(r => setTimeout(r, 20))
      slots = runtime.activeAgentSlots(home)
    }
    assert.equal(slots.length, 1)
    assert.equal(slots[0]!.agentId, agentId, 'the slot is the run the worktree is named with')
    assert.equal(slots[0]!.state, 'live')
    assert.equal(typeof slots[0]!.pid, 'number', 'and its process, so `ps` can be asked about it')
    // Stopping it returns the same name, which is what the shutdown line prints.
    assert.deepEqual(await runtime.stopAgents(2000), [agentId])
    assert.deepEqual(runtime.activeAgentSlots(home), [], 'the slot is gone once the process is')
  } finally {
    await runtime.dispose()
    await rm(cwd, RETRIED_RM)
  }
})

test('a worktree run whose child dies at boot is marked failed instead of waiting forever (#1261)', async () => {
  const cwd = await initRepo('framework-bootfail-')
  const runtime = createProjectRuntime({ driverPreflight: agentReady, cwd, env: {}, binPath: await writeDyingStub(cwd) })
  try {
    const result = (await runtime.onStart('build a thing', 'build')) as { ok: boolean; agentId?: string }
    assert.equal(result.ok, true, 'the Start itself succeeds; the death is asynchronous')
    const agentId = result.agentId!
    const worktree = worktreePath(cwd, agentId)

    // The whole point: the child never wrote a lifecycle, so the daemon leaves one.
    const meta = await waitForMeta(worktree)
    assert.ok(meta, 'the daemon wrote an agent.json for the dead child')
    assert.equal(meta.status, 'failed', 'marked failed, so the page stops saying "Waiting for the session to start"')
    assert.equal(meta.id, agentId, 'under the run id the worktree is named with')
    assert.equal(meta.startedAt, startedAtFromAgentId(agentId), 'dated by its run id, not by when the daemon noticed')
    assert.equal(meta.intent, 'build a thing', 'carrying the prompt, so the run row is identifiable')

    // The cause is visible: the child's stderr was captured and its tail is in the agent log.
    const events = await waitForLogLine(worktree, /failed to start/)
    assert.match(events, /The session failed to start: its process exited with code 1/)
    assert.match(events, /Cannot find package 'some-workspace-dep'/, 'the stderr tail names the actual boot error')
    assert.match(await readFile(agentStderrPath(worktree), 'utf8'), /ERR_MODULE_NOT_FOUND/, 'the full stderr file is kept')

    // Failed, so the teardown's retention rule keeps the checkout for inspection.
    assert.equal(await stat(worktree).then(s => s.isDirectory(), () => false), true, 'the worktree is retained')
  } finally {
    await runtime.dispose()
    await rm(cwd, RETRIED_RM)
  }
})

test('a child that wrote its own lifecycle is left alone by the failed-start marker (#1261)', async () => {
  const base = await realpath(await mkdtemp(join(tmpdir(), 'framework-bootfail-skip-')))
  try {
    await writeAgentMeta(base, 'done')
    assert.equal(await markFailedStart(base, 'run1', 'build a thing', 'its process exited with code 0'), false)
    const meta = JSON.parse(await readFile(join(base, THE_FRAMEWORK_DIR, META_FILE), 'utf8')) as AgentMeta
    assert.equal(meta.status, 'done', 'the run reported its own end; the marker does not rewrite history')
    assert.equal(await stat(join(base, THE_FRAMEWORK_DIR, EVENTS_FILE)).then(() => true, () => false), false, 'and no failure line is invented')
  } finally {
    await rm(base, RETRIED_RM)
  }
})

test('the failed-start marker is not written where the checkout is gone (#1654)', async () => {
  // A marker written into a missing path creates a `.branches/` directory that is not a worktree,
  // and every git command later run in it acts on the enclosing repo instead.
  const base = await realpath(await mkdtemp(join(tmpdir(), 'framework-bootfail-gone-')))
  try {
    const gone = join(base, 'removed-checkout')
    assert.equal(await markFailedStart(gone, 'run1', 'build a thing', 'its process was killed by SIGTERM'), false)
    assert.equal(await stat(gone).then(() => true, () => false), false, 'no directory is created')
  } finally {
    await rm(base, RETRIED_RM)
  }
})

test('isTransientAgentFailure names transport deaths, not work failures (#1281)', () => {
  assert.equal(
    isTransientAgentFailure('claude-code exited (1): API Error: Connection closed mid-response. The response above may be incomplete.'),
    true,
  )
  assert.equal(isTransientAgentFailure('read ECONNRESET'), true)
  assert.equal(isTransientAgentFailure('API Error: 529 overloaded'), true)
  // A boot death (#1261) or a real failure is not a retry candidate.
  assert.equal(isTransientAgentFailure('its process exited with code 1 before reporting anything'), false)
  assert.equal(isTransientAgentFailure('AssertionError: expected 2 to equal 3'), false)
  assert.equal(isTransientAgentFailure(undefined), false)
})

test('lastAgentFailureDetail reads the child-written end, and only a failed one (#1281)', () => {
  const line = (event: object) => JSON.stringify(event) + '\n'
  assert.equal(lastAgentFailureDetail(line({ kind: 'session' }) + line({ kind: 'end', ok: false, detail: 'boom' })), 'boom')
  assert.equal(lastAgentFailureDetail(line({ kind: 'end', ok: true })), undefined)
  assert.equal(lastAgentFailureDetail('not json\n' + line({ kind: 'end', ok: false, detail: 'boom' })), 'boom')
  assert.equal(lastAgentFailureDetail(''), undefined)
  // A continued log whose last end succeeded: the earlier failure no longer counts.
  assert.equal(lastAgentFailureDetail(line({ kind: 'end', ok: false, detail: 'boom' }) + line({ kind: 'end', ok: true })), undefined)
})

/**
 * A stub CLI that behaves like an agent whose driver died mid-work: it writes its own lifecycle
 * (agent.json + a failed `end` carrying `detail`), records each spawn, and exits 1.
 */
async function writeFailingAgentStub(dir: string, detail: string): Promise<string> {
  const stub = join(dir, 'failing-run-stub.cjs')
  await writeFile(
    stub,
    `const fs = require('node:fs')
const path = require('node:path')
const argv = process.argv.slice(2)
const spec = JSON.parse(fs.readFileSync(argv[argv.indexOf('--agent') + 1], 'utf8'))
const cwd = spec.cwd
const agentId = spec.agentId
fs.appendFileSync(path.join(cwd, 'spawned.log'), (spec.continueAgent ? 'continue' : 'start') + '\\n')
const dir = path.join(cwd, '.the-framework')
fs.mkdirSync(dir, { recursive: true })
const now = new Date().toISOString()
fs.writeFileSync(
  path.join(dir, 'agent.json'),
  JSON.stringify({ status: 'failed', id: agentId, startedAt: now, updatedAt: now, driver: 'claude-code' }),
)
fs.appendFileSync(path.join(dir, 'events.jsonl'), JSON.stringify({ kind: 'end', ok: false, detail: ${JSON.stringify(detail)} }) + '\\n')
process.exit(1)
`,
  )
  return stub
}

/** Poll the worktree's spawn record until `expected` lines show up, or time out. */
async function waitForSpawns(worktree: string, expected: number): Promise<string[]> {
  let lines: string[] = []
  for (let i = 0; i < POLL_ATTEMPTS && lines.length < expected; i++) {
    await new Promise(r => setTimeout(r, 20))
    lines = (await readFile(join(worktree, 'spawned.log'), 'utf8').catch(() => '')).trim().split('\n').filter(Boolean)
  }
  return lines
}

test('a run that dies to a transient API error is continued, at most twice (#1281)', async () => {
  const cwd = await initRepo('framework-transient-')
  const detail = 'claude-code exited (1): API Error: Connection closed mid-response. The response above may be incomplete.'
  const runtime = createProjectRuntime({ driverPreflight: agentReady, cwd, env: {}, binPath: await writeFailingAgentStub(cwd, detail), retryDelayMs: 25 })
  try {
    const result = (await runtime.onStart('build a thing', 'build')) as { ok: boolean; agentId?: string }
    assert.equal(result.ok, true)
    const worktree = worktreePath(cwd, result.agentId!)
    // The retry continues the SAME agent in its retained checkout, rather than starting a new one.
    const lines = await waitForSpawns(worktree, 1 + MAX_TRANSIENT_RETRIES)
    assert.deepEqual(lines, ['start', 'continue', 'continue'])
    // And the cap holds: an agent that keeps dying transiently stays failed.
    await new Promise(r => setTimeout(r, 400))
    const after = (await readFile(join(worktree, 'spawned.log'), 'utf8')).trim().split('\n').filter(Boolean)
    assert.equal(after.length, 1 + MAX_TRANSIENT_RETRIES)
  } finally {
    await runtime.dispose()
    await rm(cwd, RETRIED_RM)
  }
})

test('a run that fails on its own terms is not retried (#1281)', async () => {
  const cwd = await initRepo('framework-nontransient-')
  const runtime = createProjectRuntime({ driverPreflight: agentReady,
    cwd,
    env: {},
    binPath: await writeFailingAgentStub(cwd, 'AssertionError: expected 2 to equal 3'),
    retryDelayMs: 25,
  })
  try {
    const result = (await runtime.onStart('build a thing', 'build')) as { ok: boolean; agentId?: string }
    assert.equal(result.ok, true)
    const worktree = worktreePath(cwd, result.agentId!)
    const lines = await waitForSpawns(worktree, 1)
    assert.deepEqual(lines, ['start'])
    // Give a wrong retry every chance to fire before declaring it absent.
    await new Promise(r => setTimeout(r, 400))
    const after = (await readFile(join(worktree, 'spawned.log'), 'utf8')).trim().split('\n').filter(Boolean)
    assert.deepEqual(after, ['start'], 'a real failure stands; only transport deaths earn a retry')
  } finally {
    await runtime.dispose()
    await rm(cwd, RETRIED_RM)
  }
})

/**
 * #1326: an agent must not spend a branch and a worktree on a driver that can never start.
 *
 * This is what #1323 looked like from outside: every session died before writing its agent.json,
 * on both agents, across six projects, and the only visible trace was agent branches piling up
 * while the dashboard sat on "Waiting for the session to start...". The failure was a logged-out
 * CLI, which resolves and answers `--version` exactly like a working one.
 */

/** A preflight seam that reports a logged-out CLI, as `claude auth status` would. */
const loggedOut = (driver: 'claude' | 'codex'): Promise<PreflightResult> =>
  Promise.resolve({
    ok: false,
    checks: [
      { name: 'node', ok: true, detail: process.version },
      { name: `${driver} auth`, ok: false, detail: `\`${driver}\` is not logged in. Run \`${driver} auth login\`, then start the session again.` },
    ],
  })

test('a start on a logged-out agent is refused, and spends no branch or worktree (#1326)', async () => {
  const cwd = await initRepo('framework-preflight-')
  const log = join(cwd, 'spawned.log')
  const runtime = createProjectRuntime({ cwd, env: {}, binPath: await writeStub(cwd, log), driverPreflight: loggedOut })
  const git = nodeGitRunner()
  try {
    const result = (await runtime.onStart('build a thing', 'build')) as { ok: boolean; error?: string }
    assert.equal(result.ok, false)
    // The reason names the fix, rather than leaving the user to guess at a dead agent.
    assert.match(result.error!, /not logged in/)
    assert.match(result.error!, /auth login/)

    // Nothing was spent: no worktrees directory, and no agent branch on the repo.
    const worktrees = await stat(join(cwd, THE_FRAMEWORK_DIR, BRANCHES_DIR)).then(() => true, () => false)
    assert.equal(worktrees, false, 'a refused start creates no worktree')
    const branches = await git(['branch', '--list', 'agent-*'], cwd)
    assert.equal(branches.trim(), '', 'a refused start creates no run branch')

    // And no agent was spawned, so there is no dead run to explain afterwards.
    await new Promise(r => setTimeout(r, 200))
    assert.equal(await readFile(log, 'utf8').catch(() => ''), '')
  } finally {
    await runtime.dispose()
    await rm(cwd, RETRIED_RM)
  }
})

test('an actions run starts without a local agent CLI at all (#1326)', async () => {
  // An `actions` run executes on a GitHub Actions runner and is driven over the API, so gating it
  // on a local login would refuse a start that works perfectly well.
  const cwd = await initRepo('framework-preflight-actions-')
  const log = join(cwd, 'spawned.log')
  let probed = false
  const runtime = createProjectRuntime({
    cwd,
    env: {},
    binPath: await writeStub(cwd, log),
    driverPreflight: agent => {
      probed = true
      return loggedOut(agent)
    },
  })
  try {
    const result = (await runtime.onStart('build a thing', 'build', { target: 'actions' })) as { ok: boolean }
    assert.equal(result.ok, true)
    assert.equal(probed, false, 'a run that needs no local CLI is not gated on one')
  } finally {
    await runtime.dispose()
    await rm(cwd, RETRIED_RM)
  }
})

test('a passing preflight is probed once for a burst of starts (#1326)', async () => {
  // Two probes cost around half a second, which is more than the one-at-a-time guard's window.
  const cwd = await initRepo('framework-preflight-cache-')
  const log = join(cwd, 'spawned.log')
  let probes = 0
  const runtime = createProjectRuntime({
    cwd,
    env: {},
    binPath: await writeStub(cwd, log),
    driverPreflight: () => {
      probes++
      return Promise.resolve({ ok: true, checks: [{ name: 'claude', ok: true, detail: '1.2.3' }] })
    },
  })
  try {
    assert.equal(((await runtime.onStart('one', 'build')) as { ok: boolean }).ok, true)
    await runtime.onStart('two', 'build')
    await runtime.onStart('three', 'build')
    assert.equal(probes, 1, 'a pass is cached; only a failure is re-probed every time')
  } finally {
    await runtime.dispose()
    await rm(cwd, RETRIED_RM)
  }
})

test('a logged-out agent is re-probed on every start, so logging in is picked up at once (#1326)', async () => {
  const cwd = await initRepo('framework-preflight-recheck-')
  const log = join(cwd, 'spawned.log')
  let probes = 0
  const runtime = createProjectRuntime({
    cwd,
    env: {},
    binPath: await writeStub(cwd, log),
    driverPreflight: agent => {
      probes++
      // Logged out, then logged in: the fix must land on the next Start, not after a timeout.
      return probes === 1 ? loggedOut(agent) : Promise.resolve({ ok: true, checks: [] })
    },
  })
  try {
    assert.equal(((await runtime.onStart('one', 'build')) as { ok: boolean }).ok, false)
    assert.equal(((await runtime.onStart('two', 'build')) as { ok: boolean }).ok, true)
    assert.equal(probes, 2)
  } finally {
    await runtime.dispose()
    await rm(cwd, RETRIED_RM)
  }
})

/** A stub agent that records the PATH it was spawned with. */
async function writePathStub(dir: string, log: string): Promise<string> {
  const stub = join(dir, 'stub-path.cjs')
  await writeFile(stub, `require('node:fs').appendFileSync(${JSON.stringify(log)}, process.env.PATH + '\\n')\n`)
  return stub
}

test('a spawned agent finds the `branches` command on its PATH (#1725)', async () => {
  const cwd = await realpath(await mkdtemp(join(tmpdir(), 'framework-agent-path-')))
  try {
    const git = nodeGitRunner()
    await git(['init'], cwd)
    await git(['config', 'user.email', 't@t'], cwd)
    await git(['config', 'user.name', 't'], cwd)
    await writeFile(join(cwd, 'README.md'), '# t\n')
    await git(['add', '-A'], cwd)
    await git(['commit', '-m', 'init'], cwd)
    const log = join(cwd, 'path.log')
    const runtime = createProjectRuntime({ driverPreflight: agentReady, cwd, env: {}, binPath: await writePathStub(cwd, log) })
    const result = (await runtime.onStart('build a thing', 'build')) as { ok: boolean; agentId?: string }
    assert.equal(result.ok, true)
    let recorded = ''
    for (let i = 0; i < POLL_ATTEMPTS && !recorded; i++) {
      await new Promise(r => setTimeout(r, 20))
      recorded = await readFile(log, 'utf8').catch(() => '')
    }
    const path = recorded.trim()
    assert.equal(path.split(delimiter)[0], CLI_BIN_DIR, 'the package bin dir comes first')
    assert.equal(path.split(delimiter).slice(1).join(delimiter), process.env['PATH'], "after the daemon's own")
    // By name, the way the agent's shell resolves it, against the project the daemon started it in.
    const listed = await new Promise<string>((resolvePromise, rejectPromise) =>
      execFile('branches', ['list'], { cwd, env: { ...process.env, PATH: path } }, (err, stdout) => (err ? rejectPromise(err) : resolvePromise(stdout))),
    )
    assert.deepEqual(
      (JSON.parse(listed) as { agentId: string }[]).map(row => row.agentId),
      [result.agentId],
      'and it reports the checkout the daemon allocated',
    )
    await runtime.dispose()
  } finally {
    await rm(cwd, RETRIED_RM)
  }
})
