import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { DATA_BRANCH } from '@gemstack/agent-data'
import { findRun, listRuns, readDiary } from '@gemstack/skill-logs'
import { markerCard, recordRun, runnerMark, withdrawMarker, writeMarker } from './records.js'
import { git, removeRepo, testRepo } from './test-repo.js'

// The marker is the logs skill's record, on the real branch: written before the agent exists,
// read by every machine, written again at the end over the same file.

const mark = { host: 'this-box', pid: 4242 }

test('a marker is a running card on agent-data, pushed to origin, that the logs skill lists like any run', async () => {
  const repo = await testRepo()
  try {
    const card = markerCard({ id: '2026-09-16T14-01-00-000Z', startedAt: '2026-09-16T14:01:00.000Z', prompt: '/work-queue', driver: 'claude-code', model: 'opus', mark })
    const written = await writeMarker(repo, card)
    assert.ok(written.ok && written.pushed, 'the marker reached origin, so another machine sees it')
    const found = await findRun(repo, card.id)
    assert.equal(found?.status, 'running')
    assert.equal(found?.intent, '/work-queue')
    assert.deepEqual(runnerMark(found!), mark)
    assert.deepEqual(await readDiary(repo, card.id), [])
    assert.match(await git(['log', '-1', '--format=%s', `origin/${DATA_BRANCH}`], repo), /^logs: record run 2026-09-16T14-01-00-000Z/)
  } finally {
    await removeRepo(repo)
  }
})

test('the record at the end overwrites the marker: same id, same file, and a withdrawn marker is gone', async () => {
  const repo = await testRepo()
  try {
    const card = markerCard({ id: 'a1', startedAt: '2026-09-16T14:01:00.000Z', prompt: '/work-queue', driver: 'claude-code', model: 'opus', mark })
    await writeMarker(repo, card)
    await recordRun(repo, { ...card, status: 'done', endedAt: '2026-09-16T14:05:00.000Z', branch: 'agent-fix-it', cost: 1.12, pr: { number: 7, url: 'https://x/pull/7' } }, [{ kind: 'said', text: 'done' }, { kind: 'ended', status: 'done' }])
    const found = await findRun(repo, 'a1')
    assert.equal(found?.status, 'done')
    assert.equal(found?.pr?.number, 7)
    assert.deepEqual(runnerMark(found!), mark)
    assert.equal((await readDiary(repo, 'a1'))?.length, 2)

    await writeMarker(repo, markerCard({ id: 'a2', startedAt: '2026-09-16T14:06:00.000Z', prompt: '/work-queue', driver: 'claude-code', model: 'opus', mark }))
    await withdrawMarker(repo, 'a2')
    assert.equal(await findRun(repo, 'a2'), undefined)
    assert.equal((await listRuns(repo)).length, 1)
  } finally {
    await removeRepo(repo)
  }
})
