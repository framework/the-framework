import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { tmpdir } from 'node:os'
import { cliRunner, CliTimeoutError } from './cli-exec.js'

const CWD = tmpdir()

/** Node itself is the stand-in binary: every platform running these tests has one. */
const NODE = process.execPath

/** The rejection of `promise`, or `undefined` when it resolved. */
async function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => undefined,
    (err: unknown) => err,
  )
}

test('a killed process rejects as a timeout, not as a generic failure (#997)', async () => {
  const agent = cliRunner({ bin: NODE, timeoutMs: 50 })
  const err = await rejection(agent(['-e', 'setTimeout(() => {}, 5000)'], CWD))
  assert.ok(err instanceof CliTimeoutError)
  assert.match((err as Error).message, /timed out after 50ms/)
})

test('a non-zero exit is not reported as a timeout (#997)', async () => {
  const agent = cliRunner({ bin: NODE, timeoutMs: 10_000 })
  const err = await rejection(agent(['-e', 'process.exit(3)'], CWD))
  assert.ok(err instanceof Error)
  assert.equal(err instanceof CliTimeoutError, false)
})

test('a timeout names the operation and the budget it outran (#997)', () => {
  const err = new CliTimeoutError('git', ['push', '--set-upstream', 'origin', 'branch'], 120_000)
  assert.equal(err.message, 'git push --set-upstream origin branch timed out after 120000ms')
})
