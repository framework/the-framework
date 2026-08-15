import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { onProjectFiles, onProjectFileStatus, onRunWorktree } from './reads.telefunc.js'
import { provideTestContext } from './test-context.js'

// A project id nobody registered has no local path, so these reads have no checkout to answer
// from. They must say so — an empty list, an empty map, null — rather than throwing.

test('onProjectFiles for an unknown project returns an empty list', async () => {
  provideTestContext()
  assert.deepEqual(await onProjectFiles('project-that-does-not-exist'), [])
})

test('onProjectFileStatus for an unknown project returns an empty map', async () => {
  provideTestContext()
  assert.deepEqual(await onProjectFileStatus('project-that-does-not-exist'), {})
})

test('onRunWorktree for an unknown project returns null', async () => {
  provideTestContext()
  assert.equal(await onRunWorktree('project-that-does-not-exist', '2026-07-19T10-00-00-000Z'), null)
})

test('onRunWorktree refuses a run id that could escape the worktrees dir', async () => {
  // The id names a directory, so it is guarded here as it is everywhere else it reaches a path.
  provideTestContext()
  assert.equal(await onRunWorktree('project-that-does-not-exist', '../../etc'), null)
})
