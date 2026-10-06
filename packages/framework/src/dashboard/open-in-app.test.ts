import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { fileManagerCommand, editorCommand, openInApp, detectEditors, KNOWN_EDITORS } from './open-in-app.js'

test('fileManagerCommand picks the OS reveal command', () => {
  assert.deepEqual(fileManagerCommand('/p', 'darwin'), { command: 'open', args: ['/p'] })
  assert.deepEqual(fileManagerCommand('/p', 'win32'), { command: 'explorer', args: ['/p'] })
  assert.deepEqual(fileManagerCommand('/p', 'linux'), { command: 'xdg-open', args: ['/p'] })
})

test('editorCommand defaults to code, honoring $OPENAGENT_EDITOR', () => {
  assert.deepEqual(editorCommand('/p', undefined), { command: 'code', args: ['/p'] })
  assert.deepEqual(editorCommand('/p', '  '), { command: 'code', args: ['/p'] })
  assert.deepEqual(editorCommand('/p', 'subl'), { command: 'subl', args: ['/p'] })
})

test('the editor is read from $OPENAGENT_EDITOR in the environment, and from no other name', () => {
  const before = { now: process.env.OPENAGENT_EDITOR, old: process.env.FRAMEWORK_EDITOR }
  try {
    delete process.env.OPENAGENT_EDITOR
    process.env.FRAMEWORK_EDITOR = 'old-name-editor'
    assert.deepEqual(editorCommand('/p'), { command: 'code', args: ['/p'] }, 'the old name is not read')
    process.env.OPENAGENT_EDITOR = 'zed'
    assert.deepEqual(editorCommand('/p'), { command: 'zed', args: ['/p'] })
  } finally {
    for (const [key, value] of [['OPENAGENT_EDITOR', before.now], ['FRAMEWORK_EDITOR', before.old]] as const) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})

test('openInApp returns ok on a successful spawn and reports the command run', async () => {
  const calls: { command: string; args: string[] }[] = []
  const result = await openInApp('/repo', 'files', async (command, args) => {
    calls.push({ command, args })
  })
  assert.deepEqual(result, { ok: true })
  assert.equal(calls.length, 1)
  assert.equal(calls[0]!.args[0], '/repo')
})

test('openInApp reports a friendly error when the command is missing', async () => {
  const result = await openInApp('/repo', 'editor', async () => {
    const err = new Error('spawn code ENOENT') as NodeJS.ErrnoException
    err.code = 'ENOENT'
    throw err
  })
  assert.equal(result.ok, false)
  assert.match((result as { error: string }).error, /not be found|not found/i)
})

test('openInApp opens the editor with the passed-in preference (#727)', async () => {
  const calls: { command: string; args: string[] }[] = []
  await openInApp('/repo', 'editor', async (command, args) => void calls.push({ command, args }), 'zed')
  assert.deepEqual(calls[0], { command: 'zed', args: ['/repo'] })
})

test('detectEditors keeps only the probed-installed editors, in catalog order (#727)', async () => {
  const installed = new Set(['cursor', 'code'])
  const found = await detectEditors(async bin => installed.has(bin))
  assert.deepEqual(
    found.map(e => e.bin),
    KNOWN_EDITORS.filter(e => installed.has(e.bin)).map(e => e.bin),
  )
  // Nothing installed -> empty list (the picker then shows only "Default").
  assert.deepEqual(await detectEditors(async () => false), [])
})
