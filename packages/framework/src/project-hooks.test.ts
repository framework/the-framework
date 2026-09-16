import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PROJECT_HOOKS_FILE, parseProjectHooks, readProjectHooks, runProjectHooks } from './project-hooks.js'
import { THE_FRAMEWORK_DIR } from './framework-dir.js'

// The hooks file and the runner (#1774), for real: `sh -c` in a throwaway project, the lines
// leaving traces in files the assertions read back.

async function project(hooks?: string): Promise<string> {
  const cwd = await realpath(await mkdtemp(join(tmpdir(), 'framework-hooks-')))
  await mkdir(join(cwd, THE_FRAMEWORK_DIR), { recursive: true })
  if (hooks !== undefined) await writeFile(join(cwd, PROJECT_HOOKS_FILE), hooks)
  return cwd
}

test('the file: open and close lists of shell lines; missing means none; the wrong shape is refused and named', async () => {
  assert.deepEqual(parseProjectHooks(''), { open: [], close: [] })
  assert.deepEqual(parseProjectHooks('open:\n  - npx agent-scheduler start\nclose:\n  - npx agent-scheduler stop --unless-keep-alive\n'), {
    open: ['npx agent-scheduler start'],
    close: ['npx agent-scheduler stop --unless-keep-alive'],
  })
  assert.deepEqual(parseProjectHooks('open:\n  - echo one\n  - echo two\n'), { open: ['echo one', 'echo two'], close: [] })
  assert.deepEqual(parseProjectHooks('open:\nclose:\n'), { open: [], close: [] })
  assert.throws(() => parseProjectHooks('- echo hi\n'), /hooks\.yml must be a YAML map with "open" and "close" lists/)
  assert.throws(() => parseProjectHooks('opne:\n  - echo hi\n'), /unknown key "opne"; the keys are open and close/)
  assert.throws(() => parseProjectHooks('open: echo hi\n'), /"open" must be a list of shell lines/)
  assert.throws(() => parseProjectHooks('close:\n  - 3\n'), /"close" must be a list of shell lines/)

  const none = await project()
  const broken = await project('open: [\n')
  const warnings: string[] = []
  try {
    assert.deepEqual(await readProjectHooks(none, m => warnings.push(m)), { open: [], close: [] })
    assert.equal(warnings.length, 0)
    assert.deepEqual(await readProjectHooks(broken, m => warnings.push(m)), { open: [], close: [] })
    assert.equal(warnings.length, 1)
    assert.match(warnings[0]!, /^ignoring /)
  } finally {
    await rm(none, { recursive: true, force: true })
    await rm(broken, { recursive: true, force: true })
  }
})

test('the lines run in order, in the project, through the shell; a failing line is logged and the next one still runs', async () => {
  const cwd = await project('open:\n  - echo open-1 >> hooks.log\n  - pwd -P >> hooks.log\n  - echo said-so >&2; exit 3\n  - echo open-2 >> hooks.log\nclose:\n  - echo close >> hooks.log\n')
  const log: string[] = []
  try {
    await runProjectHooks(cwd, 'open', { log: line => log.push(line) })
    assert.equal(await readFile(join(cwd, 'hooks.log'), 'utf8'), `open-1\n${cwd}\nopen-2\n`)
    assert.deepEqual(log, [
      `[framework] open hook (${cwd.split('/').pop()}): echo open-1 >> hooks.log: exit 0`,
      `[framework] open hook (${cwd.split('/').pop()}): pwd -P >> hooks.log: exit 0`,
      `[framework] open hook (${cwd.split('/').pop()}): echo said-so >&2; exit 3: exit 3`,
      '[framework]   said-so',
      `[framework] open hook (${cwd.split('/').pop()}): echo open-2 >> hooks.log: exit 0`,
    ])
    await runProjectHooks(cwd, 'close', { log: line => log.push(line) })
    assert.equal(await readFile(join(cwd, 'hooks.log'), 'utf8'), `open-1\n${cwd}\nopen-2\nclose\n`)
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test('a line that hangs is killed at the bound and logged as timed out; the next one still runs', async () => {
  const cwd = await project('open:\n  - sleep 30\n  - echo after >> hooks.log\n')
  const log: string[] = []
  try {
    const started = Date.now()
    await runProjectHooks(cwd, 'open', { log: line => log.push(line), timeoutMs: 300 })
    assert.ok(Date.now() - started < 10_000, 'the bound, not the sleep, decided')
    assert.match(log[0]!, /sleep 30: timed out after 0s$/)
    assert.equal(await readFile(join(cwd, 'hooks.log'), 'utf8'), 'after\n')
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test('no file runs nothing and logs nothing; a broken file logs why it was ignored and runs nothing', async () => {
  const none = await project()
  const broken = await project('open: [\n')
  const log: string[] = []
  try {
    await runProjectHooks(none, 'open', { log: line => log.push(line) })
    assert.equal(log.length, 0)
    await runProjectHooks(broken, 'close', { log: line => log.push(line) })
    assert.equal(log.length, 1)
    assert.match(log[0]!, /^\[framework\] close hook \(.*\): ignoring .*hooks\.yml/)
  } finally {
    await rm(none, { recursive: true, force: true })
    await rm(broken, { recursive: true, force: true })
  }
})
