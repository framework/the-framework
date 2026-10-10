import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse } from 'yaml'
import { hasHooks, initHooks, removeHooks } from './init.js'

// `init` against real files: the scheduler's lines written into a fresh file. The merge into a
// person's file is the writer's, tested in agent-runner.

test('a project the dashboard knows, with no hooks file, gets the scheduler\'s lines', async () => {
  const repo = await realpath(await mkdtemp(join(tmpdir(), 'agent-scheduler-init-')))
  await mkdir(join(repo, '.openagent'))
  try {
    const outcome = await initHooks(repo)
    assert.deepEqual(outcome, { ok: true, file: join(repo, '.openagent', 'hooks.yml'), added: ['open', 'close'], kept: [] })
    assert.deepEqual(parse(await readFile(join(repo, '.openagent', 'hooks.yml'), 'utf8')), { open: ['agent-scheduler start'], close: ['agent-scheduler stop --unless-keep-alive'] })
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})

test('a line that already runs the scheduler is its line, however it is spelled: init adds no second one, and the project has the scheduler', async () => {
  const repo = await realpath(await mkdtemp(join(tmpdir(), 'agent-scheduler-init-')))
  const file = join(repo, '.openagent', 'hooks.yml')
  await mkdir(join(repo, '.openagent'))
  try {
    assert.equal(await hasHooks(repo), false, 'no file')
    // What an earlier version wrote, and a close line the person changed.
    await writeFile(file, 'open:\n  - npx agent-scheduler start\nclose:\n  - npx @openagt/agent-scheduler@0.1 stop\nstart: agent-runner run --detach "$PROMPT"\n')
    assert.equal(await hasHooks(repo), true)
    const before = await readFile(file, 'utf8')
    assert.deepEqual(await initHooks(repo), { ok: true, file, added: [], kept: [] })
    assert.equal(await readFile(file, 'utf8'), before, 'the file is as it was')

    // An open list that runs other things only gains the line; a close list that already stops it is kept.
    await writeFile(file, 'open:\n  - echo hello\nclose:\n  - agent-scheduler stop\n')
    assert.equal(await hasHooks(repo), false, 'stopping it is not starting it')
    assert.deepEqual(await initHooks(repo), { ok: true, file, added: ['open'], kept: [] })
    assert.deepEqual(parse(await readFile(file, 'utf8')), { open: ['echo hello', 'agent-scheduler start'], close: ['agent-scheduler stop'] })
    assert.equal(await hasHooks(repo), true)
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})

test('removeHooks takes out every line that runs the scheduler, and leaves the rest of the file as it was', async () => {
  const repo = await realpath(await mkdtemp(join(tmpdir(), 'agent-scheduler-init-')))
  const file = join(repo, '.openagent', 'hooks.yml')
  await mkdir(join(repo, '.openagent'))
  try {
    assert.deepEqual(await removeHooks(repo), { ok: true, file, removed: [] }, 'no file: nothing to take')
    await writeFile(file, '# mine\nstart: agent-runner run --detach "$PROMPT"\nopen:\n  - echo hello\n  - npx agent-scheduler start\n  - agent-scheduler start\nclose:\n  - agent-scheduler stop --unless-keep-alive\n')
    assert.deepEqual(await removeHooks(repo), { ok: true, file, removed: ['open', 'close'] })
    assert.equal(await readFile(file, 'utf8'), '# mine\nstart: agent-runner run --detach "$PROMPT"\nopen:\n  - echo hello\n', 'a list left empty goes with its key; the comment and the other lines stay')
    assert.equal(await hasHooks(repo), false)
    assert.deepEqual(await removeHooks(repo), { ok: true, file, removed: [] }, 'asked again: nothing left to take')

    // A file that held only the scheduler's lines goes with them.
    await initHooks(repo)
    await writeFile(file, 'open:\n  - agent-scheduler start\nclose:\n  - agent-scheduler stop --unless-keep-alive\n')
    assert.deepEqual(await removeHooks(repo), { ok: true, file, removed: ['open', 'close'] })
    assert.equal(await readFile(file, 'utf8').catch(() => undefined), undefined, 'the file is gone')

    await writeFile(file, 'open: [')
    const unreadable = await removeHooks(repo)
    assert.ok(!unreadable.ok && unreadable.reason === 'unreadable')
    assert.equal(await readFile(file, 'utf8'), 'open: [', 'a file that cannot be read is not written')
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})
