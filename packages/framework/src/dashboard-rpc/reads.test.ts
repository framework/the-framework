import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { onProjectFiles, onPlanAgent, onProjectFileStatus, onAgentWorktree, markCloudWaiting, markOtherHost } from './reads.js'
import { bridgeQuestions, resetBridgeQuestions } from '../dashboard/bridge-store.js'
import type { AgentMeta } from '../store/index.js'
import { provideTestContext } from './test-context.js'

// A project id nobody registered has no local path, so these reads have no checkout to answer
// from. They must say so — an empty list, an empty map, null — rather than throwing.

test('onProjectFiles for an unknown project returns an empty list', async () => {
  provideTestContext()
  assert.deepEqual(await onProjectFiles('project-that-does-not-exist'), [])
})

test('onPlanAgent for an unknown project returns null (#1511)', async () => {
  assert.equal(await onPlanAgent('nope', 'x.md'), null)
})

test('onProjectFileStatus for an unknown project returns an empty map', async () => {
  provideTestContext()
  assert.deepEqual(await onProjectFileStatus('project-that-does-not-exist'), {})
})

test('onAgentWorktree for an unknown project returns null', async () => {
  provideTestContext()
  assert.equal(await onAgentWorktree('project-that-does-not-exist', '2026-07-19T10-00-00-000Z'), null)
})

test('onAgentWorktree refuses a run id that could escape the worktrees dir', async () => {
  // The id names a directory, so it is guarded here as it is everywhere else it reaches a path.
  provideTestContext()
  assert.equal(await onAgentWorktree('project-that-does-not-exist', '../../etc'), null)
})

test('a web run whose session the bridge holds a question for is handed to the dashboard as waiting (#1668)', async () => {
  resetBridgeQuestions()
  bridgeQuestions().record({ sessionId: 'session_01Park', title: 'Where?', options: [{ label: 'Here' }], receivedAt: '' })
  const web = (sessionId: string): AgentMeta => ({ status: 'done', id: 'r', startedAt: '', updatedAt: '', target: 'web', sessionId }) as AgentMeta
  assert.equal(markCloudWaiting(web('session_01Park')).cloudWaiting, true)
  assert.equal(markCloudWaiting(web('session_01Other')).cloudWaiting, undefined)
  assert.equal(markCloudWaiting({ ...web('session_01Park'), target: 'local' }).cloudWaiting, undefined)
  resetBridgeQuestions()
})

test('a run another machine\'s daemon started is handed to the dashboard as from another host (#1648)', () => {
  const run = (host?: string): AgentMeta => ({ status: 'done', id: 'r', startedAt: '', updatedAt: '', ...(host ? { host } : {}) }) as AgentMeta
  assert.equal(markOtherHost(run('rom-thinkpad-x280'), 'suleiman-mbp').otherHost, true)
  assert.equal(markOtherHost(run('suleiman-mbp'), 'suleiman-mbp').otherHost, undefined)
  // A record from before the host field was written says nothing about where it ran.
  assert.equal(markOtherHost(run(), 'suleiman-mbp').otherHost, undefined)
})
