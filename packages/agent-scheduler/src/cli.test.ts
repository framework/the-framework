import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runCli } from './cli.js'
import { DEFAULT_STATE, readState, statePath, writeState } from './state.js'
import { removeRepo, testRepo } from './test-repo.js'

// The contract on top of the functions: JSON on stdout, a line for a person on stderr, and an
// exit code that says refusal or failure. The commands that spawn or talk to Claude are covered
// by their modules; here the file-only ones run for real.

interface Ran {
  code: number
  out: unknown
  err: string
}

async function run(cwd: string, ...argv: string[]): Promise<Ran> {
  const outLines: string[] = []
  const errLines: string[] = []
  const code = await runCli(argv, { cwd, stdout: line => outLines.push(line), stderr: line => errLines.push(line) })
  return { code, out: outLines.length ? JSON.parse(outLines.join('\n')) : undefined, err: errLines.join('\n') }
}

test('status reads the state; model and offset write it; stop turns it off; every answer is one JSON object', async () => {
  const repo = await testRepo()
  try {
    const fresh = await run(repo, 'status')
    assert.equal(fresh.code, 0)
    assert.deepEqual(fresh.out, { ok: true, on: false, keepAlive: false, model: 'opus', spendOffset: 100 / 14, running: false })

    const model = await run(repo, 'model', 'sonnet')
    assert.equal(model.code, 0)
    assert.equal((model.out as { model: string }).model, 'sonnet')
    const offset = await run(repo, 'offset', '50')
    assert.equal((offset.out as { spendOffset: number }).spendOffset, 50)
    assert.equal((await readState(repo)).model, 'sonnet')
    assert.match(await readFile(statePath(repo), 'utf8'), /"spendOffset": 50/)

    const stopped = await run(repo, 'stop')
    assert.equal(stopped.code, 0)
    assert.equal((stopped.out as { on: boolean }).on, false)

    // From inside a checkout the same command still acts on the project.
    const nested = await run(join(repo, '.claude'), 'status')
    assert.equal((nested.out as { model: string }).model, 'sonnet')
  } finally {
    await removeRepo(repo)
  }
})

test('usage errors exit 2 with the usage on stderr and nothing on stdout; outside a repository is a refusal', async () => {
  const repo = await testRepo()
  const elsewhere = await mkdtemp(join(tmpdir(), 'not-a-repo-'))
  try {
    for (const argv of [[], ['nope'], ['model'], ['offset', 'many'], ['status', 'extra'], ['check', 'extra'], ['init', 'extra'], ['switch', 'work-queue'], ['switch', 'work-queue', 'maybe']]) {
      const bad = await run(repo, ...argv)
      assert.equal(bad.code, 2, argv.join(' '))
      assert.equal(bad.out, undefined)
      assert.match(bad.err, /usage: agent-scheduler/)
    }
    // A driver this tool cannot start, and a driver named for a run that already has one.
    const unknown = await run(repo, 'run', 'Read the docs', '--driver', 'pi')
    assert.equal(unknown.code, 2)
    assert.match(unknown.err, /unknown driver "pi"; the drivers are claude-code and codex/)
    const unknownCheck = await run(repo, 'check', '--driver', 'pi')
    assert.equal(unknownCheck.code, 2)
    assert.match(unknownCheck.err, /unknown driver "pi"/)
    const renamed = await run(repo, 'run', '--resume', '2026-09-17T20-00-00-000Z', 'go on', '--driver', 'codex')
    assert.equal(renamed.code, 2)
    assert.match(renamed.err, /--resume takes no --driver/)
    for (const flag of ['--id', '--command']) {
      const relabelled = await run(repo, 'run', '--detach', '--resume', '2026-09-17T20-00-00-000Z', 'go on', flag, 'x')
      assert.equal(relabelled.code, 2, flag)
      assert.match(relabelled.err, /--resume takes no --id or --command/)
    }
    const followed = await run(repo, 'run', '--detach', '--resume', '2026-09-17T20-00-00-000Z', 'go on', '--then', '/post-merge-cleanup')
    assert.equal(followed.code, 2)
    assert.match(followed.err, /--resume takes no --then/)
    const outside = await run(elsewhere, 'status')
    assert.equal(outside.code, 1)
    assert.deepEqual(outside.out, { ok: false, reason: 'not-a-repo' })
    assert.equal(outside.err, 'not inside a git repository')
  } finally {
    await removeRepo(repo)
    await rm(elsewhere, { recursive: true, force: true })
  }
})

test('stop --unless-keep-alive leaves a keep-alive scheduler running, and stops any other', async () => {
  const repo = await testRepo()
  try {
    // This test's own process stands in for the scheduler's: a stop that signalled it would end the test.
    await writeState(repo, { ...DEFAULT_STATE, on: true, keepAlive: true, pid: process.pid, startedAt: '2026-01-01T00:00:00.000Z' })
    const kept = await run(repo, 'stop', '--unless-keep-alive')
    assert.equal(kept.code, 0)
    assert.equal(kept.err, 'keep-alive is on, the scheduler keeps running')
    const out = kept.out as { ok: boolean; on: boolean; kept: boolean; pid?: number }
    assert.equal(out.kept, true)
    assert.equal(out.on, true)
    assert.equal(out.pid, process.pid)
    const after = await readState(repo)
    assert.equal(after.on, true)
    assert.equal(after.pid, process.pid, 'the state is untouched')

    // Without keep-alive the flag changes nothing: off, no pid (the pid here is a dead one, so nothing is signalled).
    await writeState(repo, { ...DEFAULT_STATE, on: true, keepAlive: false, pid: 2 ** 31 - 1 })
    const stopped = await run(repo, 'stop', '--unless-keep-alive')
    assert.equal(stopped.code, 0)
    assert.equal(stopped.err, '')
    assert.deepEqual(stopped.out, { ok: true, on: false, keepAlive: false, model: 'opus', spendOffset: 100 / 14, kept: false })

    // A plain stop stops a keep-alive scheduler too: it is how a person turns the thing off.
    await writeState(repo, { ...DEFAULT_STATE, on: true, keepAlive: true, pid: 2 ** 31 - 1 })
    const plain = await run(repo, 'stop')
    assert.equal((plain.out as { on: boolean; kept: boolean }).on, false)
    assert.equal((plain.out as { kept: boolean }).kept, false)
  } finally {
    await removeRepo(repo)
  }
})

test('switch writes this machine\'s switch for a scheduled command; a command with no line, or no schedule, is refused', async () => {
  const repo = await testRepo()
  try {
    const none = await run(repo, 'switch', 'post-merge-cleanup', 'on')
    assert.equal(none.code, 1)
    assert.deepEqual(none.out, { ok: false, reason: 'no-schedule' })

    await writeFile(join(repo, 'agent-schedule.md'), '- work-queue: when `npx queue`\n- post-merge-cleanup: every 1d, off\n')
    const on = await run(repo, 'switch', 'post-merge-cleanup', 'on')
    assert.equal(on.code, 0)
    assert.deepEqual((on.out as { switches: unknown }).switches, { 'post-merge-cleanup': true })
    await run(repo, 'switch', 'work-queue', 'off')
    assert.deepEqual((await readState(repo)).switches, { 'post-merge-cleanup': true, 'work-queue': false })
    // Back to what the lines say: nothing kept.
    await run(repo, 'switch', 'post-merge-cleanup', 'off')
    await run(repo, 'switch', 'work-queue', 'on')
    assert.equal((await readState(repo)).switches, undefined)

    const unknown = await run(repo, 'switch', 'triage-quick', 'on')
    assert.equal(unknown.code, 1)
    assert.deepEqual(unknown.out, { ok: false, reason: 'not-scheduled', command: 'triage-quick' })
    assert.equal(unknown.err, 'agent-schedule.md has no line for triage-quick')
  } finally {
    await removeRepo(repo)
  }
})

test('tick on a project with the scheduler off: the branch is pulled, nothing is decided, the state remembers the tick', async () => {
  const repo = await testRepo()
  try {
    await writeFile(join(repo, 'agent-schedule.md'), '- work-queue: when `echo []`\n')
    const ticked = await run(repo, 'tick')
    assert.equal(ticked.code, 0)
    const out = ticked.out as { ok: boolean; note?: string; decisions: unknown[] }
    assert.equal(out.note, 'off')
    assert.deepEqual(out.decisions, [])
    assert.equal((await readState(repo)).lastTick?.note, 'off')
  } finally {
    await removeRepo(repo)
  }
})
