import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { markerCard, recordRun, writeMarker } from 'agent-runner'
import { listRuns } from '@gemstack/skill-logs'
import { commandOf, inFlight, lastStart } from './records.js'
import { parseSchedule } from './schedule.js'
import { removeRepo, testRepo } from './test-repo.js'

// The runs a command has, counted off agent-runner's records on the real branch, every machine's.

const mark = { host: 'this-box', pid: 4242 }

test('the last start of a command is its newest card on any machine, whatever became of the run; a command never started has none', async () => {
  const repo = await testRepo()
  try {
    await writeMarker(repo, markerCard({ id: 'a1', startedAt: '2026-09-16T14:01:00.000Z', prompt: '/work-queue', driver: 'claude-code', model: 'opus', mark }))
    await recordRun(repo, { id: 'a0', startedAt: '2026-09-16T09:00:00.000Z', status: 'done', intent: '/work-queue', caller: { runner: { host: 'other-box' } } }, [])
    await recordRun(repo, { id: 'a2', startedAt: '2026-09-16T14:02:00.000Z', status: 'failed', intent: '/work-queue', caller: { runner: { host: 'other-box' } } }, [])
    await recordRun(repo, { id: 'd1', startedAt: '2026-09-16T15:00:00.000Z', status: 'running', intent: 'a dashboard run' }, [])
    assert.equal(await lastStart(repo, 'work-queue', undefined), '2026-09-16T14:02:00.000Z')
    assert.equal(await lastStart(repo, 'triage-quick', undefined), undefined)
  } finally {
    await removeRepo(repo)
  }
})

test('in flight counts the running cards of one command, whatever the machine; a card agent-runner did not write is not counted', async () => {
  const repo = await testRepo()
  try {
    await writeMarker(repo, markerCard({ id: 'a1', startedAt: '2026-09-16T14:01:00.000Z', prompt: '/work-queue', driver: 'claude-code', model: 'opus', mark }))
    await writeMarker(repo, markerCard({ id: 'a2', startedAt: '2026-09-16T14:02:00.000Z', prompt: '/work-queue', driver: 'claude-code', model: 'opus', mark: { ...mark, host: 'other-box' } }))
    await writeMarker(repo, markerCard({ id: 'b1', startedAt: '2026-09-16T14:03:00.000Z', prompt: '/triage', driver: 'claude-code', model: 'opus', mark }))
    await recordRun(repo, { id: 'd1', startedAt: '2026-09-16T13:00:00.000Z', status: 'running', intent: 'a dashboard run' }, [])
    assert.deepEqual((await inFlight(repo, 'work-queue', undefined)).map(c => c.id).sort(), ['a1', 'a2'])
    assert.deepEqual((await inFlight(repo, 'triage', undefined)).map(c => c.id), ['b1'])
    assert.equal((await listRuns(repo)).length, 4)
  } finally {
    await removeRepo(repo)
  }
})

test('a run counts for the schedule line its prompt names, else for its prompt\'s first word; a run agent-runner did not start counts for none', () => {
  const schedule = parseSchedule('- triage quick: every 6h\n- work-queue: when `npx queue`\n')
  const card = (intent: string) => markerCard({ id: 'x', startedAt: '2026-09-16T14:01:00.000Z', prompt: intent, driver: 'claude-code', mark })
  assert.equal(commandOf(card('/triage quick'), schedule), 'triage quick')
  assert.equal(commandOf(card('/triage'), schedule), 'triage')
  assert.equal(commandOf(card('/work-queue now'), schedule), 'work-queue')
  assert.equal(commandOf(card('/post-merge-cleanup 2026-09-16T14-01-00-000Z'), schedule), 'post-merge-cleanup', 'a follow-up counts for its own command')
  assert.equal(commandOf(card('Read the docs'), schedule), 'Read')
  assert.equal(commandOf(card('/triage quick'), undefined), 'triage', 'no schedule: the first word')
  assert.equal(commandOf({ id: 'd1', startedAt: '2026-09-16T13:00:00.000Z', status: 'running', intent: '/triage quick' }, schedule), undefined)
})
