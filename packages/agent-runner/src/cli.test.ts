import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runCli } from './cli.js'
import { removeRepo, testRepo } from './test-repo.js'

// The contract on top of the functions: JSON on stdout, a line for a person on stderr, and an
// exit code that says refusal or failure. The commands that spawn or talk to Claude are covered
// by their modules; here the command line's own refusals.

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

test('usage errors exit 2 with the usage on stderr and nothing on stdout; outside a repository is a refusal', async () => {
  const repo = await testRepo()
  const elsewhere = await mkdtemp(join(tmpdir(), 'not-a-repo-'))
  try {
    for (const argv of [[], ['nope'], ['check', 'extra'], ['init', 'extra'], ['tick'], ['status']]) {
      const bad = await run(repo, ...argv)
      assert.equal(bad.code, 2, argv.join(' '))
      assert.equal(bad.out, undefined)
      assert.match(bad.err, /usage: agent-runner/)
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
    const relabelled = await run(repo, 'run', '--detach', '--resume', '2026-09-17T20-00-00-000Z', 'go on', '--id', 'x')
    assert.equal(relabelled.code, 2)
    assert.match(relabelled.err, /--resume takes no --id/)
    const commanded = await run(repo, 'run', 'Read the docs', '--command', 'x')
    assert.equal(commanded.code, 2, 'a run names no command: a scheduler reads the command off the prompt')
    const followed = await run(repo, 'run', '--detach', '--resume', '2026-09-17T20-00-00-000Z', 'go on', '--then', '/post-merge-cleanup')
    assert.equal(followed.code, 2)
    assert.match(followed.err, /--resume takes no --then/)
    const outside = await run(elsewhere, 'check')
    assert.equal(outside.code, 1)
    assert.deepEqual(outside.out, { ok: false, reason: 'not-a-repo' })
    assert.equal(outside.err, 'not inside a git repository')
  } finally {
    await removeRepo(repo)
    await rm(elsewhere, { recursive: true, force: true })
  }
})
