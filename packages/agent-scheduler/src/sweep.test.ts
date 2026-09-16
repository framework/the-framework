import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdir, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createCheckout, worktreePath } from '@gemstack/skill-branches'
import { findRun, readDiary } from '@gemstack/skill-logs'
import { LiveLog, readLiveMeta, type LiveMeta } from './live-log.js'
import { markerCard, writeMarker } from './records.js'
import { runStderrPath, writeState, DEFAULT_STATE } from './state.js'
import { sweep } from './sweep.js'
import { git, removeRepo, testRepo } from './test-repo.js'

// The belt: what a dead run's process left is recorded and reclaimed, on this machine only.

const NOW = new Date('2026-09-16T14:30:00.000Z')

async function liveRun(repo: string, id: string, host: string, pid: number): Promise<LiveMeta> {
  const checkout = await createCheckout(repo, { agentId: id })
  const meta: LiveMeta = { status: 'running', id, startedAt: '2026-09-16T14:01:00.000Z', updatedAt: '2026-09-16T14:01:00.000Z', pid, host, intent: '/work-queue', kind: 'prompt', scheduler: { command: 'work-queue', host, pid } }
  const log = await LiveLog.open(checkout.path, meta)
  await log.append({ kind: 'intent', text: '/work-queue' })
  await log.append({ kind: 'driver', event: { type: 'text', text: 'working…' } })
  await writeMarker(repo, markerCard({ id, startedAt: meta.startedAt, prompt: '/work-queue', driver: 'fake', model: 'opus', mark: meta.scheduler }))
  return meta
}

test('a running checkout under a dead pid on this machine is ended, recorded failed with what it said, and reclaimed', async () => {
  const repo = await testRepo()
  try {
    await liveRun(repo, 'dead', 'this-box', 999_999)
    await liveRun(repo, 'alive', 'this-box', 1)
    await liveRun(repo, 'elsewhere', 'other-box', 999_999)
    const result = await sweep(repo, { host: 'this-box', isAlive: pid => pid === 1, now: () => NOW })
    assert.deepEqual(result.recorded, [{ id: 'dead', status: 'failed' }])
    assert.deepEqual(result.reclaimed, ['dead'])
    assert.equal(await stat(worktreePath(repo, 'dead')).then(() => true, () => false), false)
    const card = await findRun(repo, 'dead')
    assert.equal(card?.status, 'failed')
    assert.equal(card?.endedAt, NOW.toISOString())
    const diary = (await readDiary(repo, 'dead'))!
    assert.deepEqual(diary.find(l => l.kind === 'said'), { kind: 'said', text: 'working…' })
    assert.deepEqual(diary.at(-1), { kind: 'ended', status: 'failed', detail: 'its process died before the run ended' })
    // The live one and the other machine's are left as they are.
    assert.equal((await readLiveMeta(worktreePath(repo, 'alive')))?.status, 'running')
    assert.equal((await readLiveMeta(worktreePath(repo, 'elsewhere')))?.status, 'running')
    assert.equal((await findRun(repo, 'elsewhere'))?.status, 'running')
  } finally {
    await removeRepo(repo)
  }
})

test('a run that ended but whose process died before the record: recorded as it ended, reclaimed', async () => {
  const repo = await testRepo()
  try {
    const meta = await liveRun(repo, 'ended', 'this-box', 999_999)
    const checkout = worktreePath(repo, 'ended')
    const log = await LiveLog.open(checkout, meta)
    await log.append({ kind: 'end', ok: true })
    const result = await sweep(repo, { host: 'this-box', isAlive: () => false, now: () => NOW })
    assert.deepEqual(result.recorded, [{ id: 'ended', status: 'done' }])
    assert.equal((await findRun(repo, 'ended'))?.status, 'done')
    assert.deepEqual(result.reclaimed, ['ended'])
  } finally {
    await removeRepo(repo)
  }
})

test('a marker of this machine with no checkout behind it: failed with the stderr the spawn left, else stopped as gone', async () => {
  const repo = await testRepo()
  try {
    await writeState(repo, DEFAULT_STATE)
    const mark = { command: 'work-queue', host: 'this-box', pid: 999_999 }
    await writeMarker(repo, markerCard({ id: 'crashed', startedAt: '2026-09-16T14:01:00.000Z', prompt: '/work-queue', driver: 'fake', model: 'opus', mark }))
    await mkdir(join(repo, '.agent-scheduler', 'runs'), { recursive: true })
    await writeFile(runStderrPath(repo, 'crashed'), 'node: cannot find module agent-driver\n')
    await writeMarker(repo, markerCard({ id: 'vanished', startedAt: '2026-09-16T14:02:00.000Z', prompt: '/work-queue', driver: 'fake', model: 'opus', mark }))
    await writeMarker(repo, markerCard({ id: 'theirs', startedAt: '2026-09-16T14:03:00.000Z', prompt: '/work-queue', driver: 'fake', model: 'opus', mark: { ...mark, host: 'other-box' } }))
    const result = await sweep(repo, { host: 'this-box', isAlive: () => false, now: () => NOW })
    assert.deepEqual(result.recorded.sort((a, b) => a.id.localeCompare(b.id)), [{ id: 'crashed', status: 'failed' }, { id: 'vanished', status: 'stopped' }])
    assert.match((await readDiary(repo, 'crashed'))![0]!['detail'] as string, /cannot find module agent-driver/)
    assert.equal((await findRun(repo, 'theirs'))?.status, 'running', "another machine's marker is that machine's")
  } finally {
    await removeRepo(repo)
  }
})

test('a marker whose process is alive and whose checkout is not there yet is a run still booting: left alone', async () => {
  const repo = await testRepo()
  try {
    const mark = { command: 'work-queue', host: 'this-box', pid: 1 }
    await writeMarker(repo, markerCard({ id: 'booting', startedAt: '2026-09-16T14:01:00.000Z', prompt: '/work-queue', driver: 'fake', model: 'opus', mark }))
    const result = await sweep(repo, { host: 'this-box', isAlive: pid => pid === 1, now: () => NOW })
    assert.deepEqual(result.recorded, [])
    assert.equal((await findRun(repo, 'booting'))?.status, 'running')
    assert.equal((await git(['status', '--porcelain'], repo)).trim(), '')
  } finally {
    await removeRepo(repo)
  }
})
