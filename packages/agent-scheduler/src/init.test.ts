import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdir, mkdtemp, readFile, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse } from 'yaml'
import { initHooks } from './init.js'

// `init` against real files: the scheduler's lines written into a fresh file. The merge into a
// person's file is the writer's, tested in agent-runner.

test('a project the dashboard knows, with no hooks file, gets the scheduler\'s lines', async () => {
  const repo = await realpath(await mkdtemp(join(tmpdir(), 'agent-scheduler-init-')))
  await mkdir(join(repo, '.the-framework'))
  try {
    const outcome = await initHooks(repo)
    assert.deepEqual(outcome, { ok: true, file: join(repo, '.the-framework', 'hooks.yml'), added: ['open', 'close'], kept: [] })
    assert.deepEqual(parse(await readFile(join(repo, '.the-framework', 'hooks.yml'), 'utf8')), { open: ['npx agent-scheduler start'], close: ['npx agent-scheduler stop --unless-keep-alive'] })
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})
