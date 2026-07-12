import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { summarizeProject, singleProjectProvider, type SummarizeDeps } from './projects.js'
import type { ProjectRecord } from '../registry.js'
import type { LogEntry } from '../logs.js'

const RECORD: ProjectRecord = { id: 'app-a-1', path: '/repos/app-a', addedAt: '2026-07-11T00:00:00.000Z' }

function deps(over: SummarizeDeps): SummarizeDeps {
  return { isActivated: async () => true, readLogs: async () => [], ...over }
}

test('summarizeProject derives name from the path basename', async () => {
  const summary = await summarizeProject(RECORD, deps({}))
  assert.equal(summary.name, 'app-a')
  assert.equal(summary.id, 'app-a-1')
  assert.equal(summary.path, '/repos/app-a')
})

test('lastActivityAt is the newest LOGS.md entry (readLogs is newest-first)', async () => {
  const logs: LogEntry[] = [
    { at: '2026-07-11T10:00:00.000Z', kind: 'build', title: 'newest', status: 'done' },
    { at: '2026-07-10T09:00:00.000Z', kind: 'prompt', title: 'older', status: 'done' },
  ]
  const summary = await summarizeProject(RECORD, deps({ readLogs: async () => logs }))
  assert.equal(summary.lastActivityAt, '2026-07-11T10:00:00.000Z')
})

test('no log entries means no lastActivityAt key at all', async () => {
  const summary = await summarizeProject(RECORD, deps({ readLogs: async () => [] }))
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
      readLogs: async () => {
        throw new Error('read failed')
      },
    }),
  )
  assert.equal(summary.activated, false)
  assert.equal('lastActivityAt' in summary, false)
})

test('singleProjectProvider (#427) lists exactly the one cwd under the fixed id', async () => {
  const provider = singleProjectProvider('/repos/scratch')
  const list = await provider.list()
  assert.equal(list.length, 1)
  assert.equal(list[0]?.id, 'home')
  assert.equal(list[0]?.path, '/repos/scratch')
  assert.equal(list[0]?.name, 'scratch')
})

test('singleProjectProvider resolves the fixed id to cwd and everything else to nothing', async () => {
  const provider = singleProjectProvider('/repos/scratch')
  assert.equal(await provider.resolvePath('home'), '/repos/scratch')
  assert.equal(await provider.resolvePath('anything-else'), undefined)
})

test('singleProjectProvider honors a custom id', async () => {
  const provider = singleProjectProvider('/repos/scratch', 'run-1')
  assert.equal((await provider.list())[0]?.id, 'run-1')
  assert.equal(await provider.resolvePath('run-1'), '/repos/scratch')
  assert.equal(await provider.resolvePath('home'), undefined)
})
