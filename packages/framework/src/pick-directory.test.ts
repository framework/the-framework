import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { pickDirectory, type DialogRunner } from './pick-directory.js'

const runner = (result: { code: number; stdout?: string; stderr?: string }, calls?: string[][]): DialogRunner => {
  return (command, args) => {
    calls?.push([command, ...args])
    return Promise.resolve({ code: result.code, stdout: result.stdout ?? '', stderr: result.stderr ?? '' })
  }
}

test('a picked folder comes back as its POSIX path, trailing slash dropped (#1150)', async () => {
  const calls: string[][] = []
  const picked = await pickDirectory('darwin', runner({ code: 0, stdout: '/Users/dev/my-repo/\n' }, calls))
  assert.deepEqual(picked, { ok: true, path: '/Users/dev/my-repo' })
  assert.equal(calls[0]?.[0], 'osascript', 'the dialog is the OS one, via osascript')
  assert.match(calls[0]?.[2] ?? '', /choose folder/, 'osascript renders the standard folder sheet')
})

test('dismissing the dialog is a normal outcome, not an error', async () => {
  const picked = await pickDirectory('darwin', runner({ code: 1, stderr: 'execution error: User canceled. (-128)' }))
  assert.deepEqual(picked, { ok: true, path: null })
})

test('a dialog failure surfaces its reason', async () => {
  const picked = await pickDirectory('darwin', runner({ code: 1, stderr: 'osascript: no display' }))
  assert.deepEqual(picked, { ok: false, error: 'osascript: no display' })
})

test('a platform without a wired picker says so instead of trying', async () => {
  const run: DialogRunner = () => {
    throw new Error('must not spawn anything')
  }
  const picked = await pickDirectory('linux', run)
  assert.equal(picked.ok, false)
  assert.match((picked as { error: string }).error, /macOS/)
})
