import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runCli } from './cli.js'
import { readState, statePath } from './state.js'
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
    for (const argv of [[], ['nope'], ['model'], ['offset', 'many'], ['status', 'extra']]) {
      const bad = await run(repo, ...argv)
      assert.equal(bad.code, 2, argv.join(' '))
      assert.equal(bad.out, undefined)
      assert.match(bad.err, /usage: agent-scheduler/)
    }
    const outside = await run(elsewhere, 'status')
    assert.equal(outside.code, 1)
    assert.deepEqual(outside.out, { ok: false, reason: 'not-a-repo' })
    assert.equal(outside.err, 'not inside a git repository')
  } finally {
    await removeRepo(repo)
    await rm(elsewhere, { recursive: true, force: true })
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
