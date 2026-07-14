import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { fileManagerCommand, editorCommand, openInApp } from './open-in-app.js'

test('fileManagerCommand picks the OS reveal command', () => {
  assert.deepEqual(fileManagerCommand('/p', 'darwin'), { command: 'open', args: ['/p'] })
  assert.deepEqual(fileManagerCommand('/p', 'win32'), { command: 'explorer', args: ['/p'] })
  assert.deepEqual(fileManagerCommand('/p', 'linux'), { command: 'xdg-open', args: ['/p'] })
})

test('editorCommand defaults to code, honoring $FRAMEWORK_EDITOR', () => {
  assert.deepEqual(editorCommand('/p', undefined), { command: 'code', args: ['/p'] })
  assert.deepEqual(editorCommand('/p', '  '), { command: 'code', args: ['/p'] })
  assert.deepEqual(editorCommand('/p', 'subl'), { command: 'subl', args: ['/p'] })
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
