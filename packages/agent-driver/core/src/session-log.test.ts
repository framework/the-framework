import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SessionLog } from './session-log.js'

const kinds = async (log: SessionLog): Promise<string[]> =>
  (await readFile(log.diaryPath, 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line).kind)

test('the message being written goes in the live file, never the diary, and goes once the message is whole', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'session-log-live-'))
  try {
    const log = new SessionLog(dir, { id: 'r1' })
    await log.open()
    void log.record({ type: 'partial', text: 'Rivers car' })
    void log.record({ type: 'partial', text: 'Rivers carve' })
    await log.record({ type: 'partial', text: 'Rivers carve valleys.' })
    assert.equal(await readFile(join(dir, 'r1.live'), 'utf8'), 'Rivers carve valleys.')
    assert.deepEqual(await kinds(log), [])
    await log.record({ type: 'text', text: 'Rivers carve valleys.' })
    assert.equal(existsSync(join(dir, 'r1.live')), false)
    assert.deepEqual(await kinds(log), ['said'])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('a run that ends mid-message leaves no live file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'session-log-live-'))
  try {
    const log = new SessionLog(dir, { id: 'r1' })
    await log.open()
    await log.record({ type: 'partial', text: 'Half a' })
    assert.equal(existsSync(log.livePath), true)
    await log.end('stopped')
    assert.equal(existsSync(log.livePath), false)
    assert.deepEqual(await kinds(log), ['ended'])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
