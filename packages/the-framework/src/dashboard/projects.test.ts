import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { summarizeProject, type SummarizeDeps } from './projects.js'
import type { ProjectRecord } from '../registry.js'
import { AGENT_META_VERSION, type AgentMeta } from '../store/index.js'

const RECORD: ProjectRecord = { id: 'app-a-1', path: '/repos/app-a', addedAt: '2026-07-11T00:00:00.000Z' }

function deps(over: SummarizeDeps): SummarizeDeps {
  return {
    isActivated: async () => true,
    readAgents: async () => [],
    readFileConfig: async () => ({}),
    ...over,
  }
}

const agent = (id: string, updatedAt: string): AgentMeta => ({
  version: AGENT_META_VERSION,
  status: 'stopped',
  id,
  startedAt: updatedAt,
  updatedAt,
})

test('summarizeProject derives name from the path basename', async () => {
  const summary = await summarizeProject(RECORD, deps({}))
  assert.equal(summary.name, 'app-a')
  assert.equal(summary.id, 'app-a-1')
  assert.equal(summary.path, '/repos/app-a')
})

test('lastActivityAt is the newest run (#645)', async () => {
  // The sessions are the history (B3). It used to be the newest of these and the latest LOGS.md
  // entry — a committed markdown re-narration of the same sessions, always the older of the two.
  const summary = await summarizeProject(
    RECORD,
    deps({ readAgents: async () => [agent('b', '2026-07-12T00:00:00.000Z'), agent('a', '2026-07-10T00:00:00.000Z')] }),
  )
  assert.equal(summary.lastActivityAt, '2026-07-12T00:00:00.000Z')
})

test('no runs means no lastActivityAt key at all', async () => {
  const summary = await summarizeProject(RECORD, deps({ readAgents: async () => [] }))
  assert.equal('lastActivityAt' in summary, false)
})

test('activation reflects the injected check', async () => {
  const summary = await summarizeProject(RECORD, deps({ isActivated: async () => false }))
  assert.equal(summary.activated, false)
})

test('a throwing reader is forgiving: inactive, no activity, never throws', async () => {
  const summary = await summarizeProject(
    RECORD,
    deps({
      isActivated: async () => {
        throw new Error('stat failed')
      },
      readAgents: async () => {
        throw new Error('read failed')
      },
    }),
  )
  assert.equal(summary.activated, false)
  assert.equal('lastActivityAt' in summary, false)
})

test('the summary carries the repo the-framework.yml so the launcher can resolve (#842)', async () => {
  const summary = await summarizeProject(
    RECORD,
    deps({ readFileConfig: async () => ({ preset: 'software-development', autopilot: true }) }),
  )
  assert.deepEqual(summary.fileConfig, { preset: 'software-development', autopilot: true })
})

test('a repo that sets nothing carries no fileConfig key at all (#842)', async () => {
  const summary = await summarizeProject(RECORD, deps({ readFileConfig: async () => ({}) }))
  assert.equal('fileConfig' in summary, false)
})

test('an unreadable yml leaves the summary intact (#842)', async () => {
  // loadFrameworkConfig already downgrades a malformed file to {}; this covers the read itself
  // failing, which must not take the whole project summary down with it.
  const summary = await summarizeProject(
    RECORD,
    deps({
      readFileConfig: async () => {
        throw new Error('EACCES')
      },
    }),
  )
  assert.equal(summary.name, 'app-a')
  assert.equal(summary.fileConfig, undefined)
})
