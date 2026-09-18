import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PROJECT_HOOKS_FILE, parseProjectHooks, readProjectHooks, runOffsetHook, runProjectHooks, runResumeHook, runStartHook } from './project-hooks.js'
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
  assert.throws(() => parseProjectHooks('- echo hi\n'), /hooks\.yml must be a YAML map; the keys are open, close, start, resume and offset/)
  assert.throws(() => parseProjectHooks('opne:\n  - echo hi\n'), /unknown key "opne"; the keys are open, close, start, resume and offset/)
  assert.throws(() => parseProjectHooks('open: echo hi\n'), /"open" must be a list of shell lines/)
  assert.throws(() => parseProjectHooks('close:\n  - 3\n'), /"close" must be a list of shell lines/)
  assert.deepEqual(parseProjectHooks('start: npx agent-scheduler run --detach "$PROMPT"\nresume:\n'), { open: [], close: [], start: 'npx agent-scheduler run --detach "$PROMPT"' })
  assert.throws(() => parseProjectHooks('start:\n  - echo hi\n'), /"start" must be one shell line/)
  assert.throws(() => parseProjectHooks('resume: 3\n'), /"resume" must be one shell line/)
  assert.deepEqual(parseProjectHooks('offset: npx agent-scheduler offset "$POINTS"\n'), { open: [], close: [], offset: 'npx agent-scheduler offset "$POINTS"' })
  assert.throws(() => parseProjectHooks('offset:\n  - echo hi\n'), /"offset" must be one shell line/)

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

test('the start line gets the prompt and the picks in its environment, and the id it answers on stdout comes back', async () => {
  const cwd = await project(`start: 'printf "%s|%s|%s" "$PROMPT" "$DRIVER" "\${MODEL-unset}" > started.txt; echo "{\\"ok\\":true,\\"id\\":\\"run-1\\"}"'\n`)
  try {
    assert.deepEqual(await runStartHook(cwd, { prompt: '/work-queue "now"', driver: 'codex' }), { ok: true, id: 'run-1' })
    assert.equal(await readFile(join(cwd, 'started.txt'), 'utf8'), '/work-queue "now"|codex|unset')
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test('the resume line gets the run and the text or the answer', async () => {
  const cwd = await project(`resume: 'printf "%s|%s|%s" "$RUN_ID" "\${TEXT-unset}" "\${ANSWER-unset}" >> resumed.txt; echo "{\\"id\\":\\"$RUN_ID\\"}"'\n`)
  try {
    assert.deepEqual(await runResumeHook(cwd, { runId: 'run-1', text: 'go on' }), { ok: true, id: 'run-1' })
    assert.deepEqual(await runResumeHook(cwd, { runId: 'run-2', answer: 'Yes' }), { ok: true, id: 'run-2' })
    assert.equal(await readFile(join(cwd, 'resumed.txt'), 'utf8'), 'run-1|go on|unsetrun-2|unset|Yes')
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test('no start line, a broken file, a failing line, a line that answers no id, a line that hangs: each is an error in words', async () => {
  const none = await project('open:\n  - echo hi\n')
  const broken = await project('start: [\n')
  const failing = await project('start: echo "the project has no such command" >&2; exit 1\n')
  const mute = await project('start: echo done\n')
  const hanging = await project('start: sleep 30\n')
  try {
    assert.deepEqual(await runStartHook(none, { prompt: 'x' }), { ok: false, error: 'this project has no start hook' })
    assert.deepEqual(await runResumeHook(none, { runId: 'r', text: 'x' }), { ok: false, error: 'this project has no resume hook' })
    const said = await runStartHook(broken, { prompt: 'x' })
    assert.ok(!said.ok && /^ignoring .*hooks\.yml/.test(said.error), JSON.stringify(said))
    assert.deepEqual(await runStartHook(failing, { prompt: 'x' }), { ok: false, error: 'the start hook: the project has no such command' })
    assert.deepEqual(await runStartHook(mute, { prompt: 'x' }), { ok: false, error: 'the start hook: it answered no run id' })
    assert.deepEqual(await runStartHook(hanging, { prompt: 'x' }, { timeoutMs: 300 }), { ok: false, error: 'the start hook: timed out after 0s' })
  } finally {
    for (const dir of [none, broken, failing, mute, hanging]) await rm(dir, { recursive: true, force: true })
  }
})

test('the offset line gets the points; no line, a failing line and a broken file are each an answer in words', async () => {
  const cwd = await project(`offset: 'printf "%s" "$POINTS" > offset.txt'\n`)
  const none = await project('open:\n  - echo hi\n')
  const failing = await project('offset: echo "not a number of percentage points" >&2; exit 1\n')
  const broken = await project('offset: [\n')
  try {
    assert.deepEqual(await runOffsetHook(cwd, -12.5), { ok: true })
    assert.equal(await readFile(join(cwd, 'offset.txt'), 'utf8'), '-12.5')
    assert.deepEqual(await runOffsetHook(none, 3), { ok: false, error: 'this project has no offset hook', noHook: true })
    assert.deepEqual(await runOffsetHook(failing, 3), { ok: false, error: 'the offset hook: not a number of percentage points' })
    const said = await runOffsetHook(broken, 3)
    assert.ok(!said.ok && !('noHook' in said) && /^ignoring .*hooks\.yml/.test(said.error), JSON.stringify(said))
  } finally {
    for (const dir of [cwd, none, failing, broken]) await rm(dir, { recursive: true, force: true })
  }
})
