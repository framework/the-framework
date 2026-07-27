import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { releaseStalePinnedBranch } from './stale-branch.js'
import type { GitRunner } from './project.js'
import type { LinkedPr } from './dashboard/gh.js'

const BRANCH = 'the-framework/triage-quick'

/** A {@link GitRunner} over canned branch state, recording every deletion it is asked for. */
function fakeGit(state: { local?: boolean; remote?: boolean; refuseDeletes?: boolean }) {
  const deleted: string[] = []
  const run: GitRunner = async args => {
    if (args[0] === 'show-ref') {
      if (state.local) return `abc refs/heads/${BRANCH}\n`
      throw new Error('not a valid ref')
    }
    if (args[0] === 'ls-remote') return state.remote ? `abc\trefs/heads/${BRANCH}\n` : ''
    if (args[0] === 'push') {
      if (state.refuseDeletes) throw new Error('remote hung up')
      deleted.push('remote')
      return ''
    }
    if (args[0] === 'branch') {
      if (state.refuseDeletes) throw new Error('checked out in a worktree')
      deleted.push('local')
      return ''
    }
    throw new Error(`unexpected git ${args.join(' ')}`)
  }
  return { run, deleted }
}

const pr = (state: string): LinkedPr => ({ number: 1, url: 'https://x/1', state, title: 'triage' })

test('a closed PR releases both copies of the pinned branch (#1293)', async () => {
  const git = fakeGit({ local: true, remote: true })
  const outcome = await releaseStalePinnedBranch('/repo', BRANCH, { git: git.run, prs: async () => [pr('CLOSED')] })
  assert.equal(outcome, 'released')
  assert.deepEqual(git.deleted, ['remote', 'local'])
})

test('a merged PR releases a remote-only leftover without touching local refs (#1293)', async () => {
  const git = fakeGit({ remote: true })
  const outcome = await releaseStalePinnedBranch('/repo', BRANCH, { git: git.run, prs: async () => [pr('MERGED')] })
  assert.equal(outcome, 'released')
  assert.deepEqual(git.deleted, ['remote'])
})

test('an open PR is a triage genuinely pending, so the branch is kept (#1293)', async () => {
  const git = fakeGit({ local: true, remote: true })
  const outcome = await releaseStalePinnedBranch('/repo', BRANCH, {
    git: git.run,
    prs: async () => [pr('CLOSED'), pr('OPEN')],
  })
  assert.equal(outcome, 'pending')
  assert.deepEqual(git.deleted, [])
})

test('a branch with no PR history is unprovable, not stale: kept (#1293)', async () => {
  // Either a run still working toward its handoff, or a gh that could not answer (ghPrsForBranch
  // resolves [] on failure). Deleting on a hiccup would discard work, so neither is released.
  const git = fakeGit({ local: true })
  const outcome = await releaseStalePinnedBranch('/repo', BRANCH, { git: git.run, prs: async () => [] })
  assert.equal(outcome, 'unproven')
  assert.deepEqual(git.deleted, [])
})

test('no branch anywhere means no PR read at all (#1293)', async () => {
  const git = fakeGit({})
  let asked = 0
  const outcome = await releaseStalePinnedBranch('/repo', BRANCH, {
    git: git.run,
    prs: async () => {
      asked += 1
      return []
    },
  })
  assert.equal(outcome, 'absent')
  assert.equal(asked, 0)
})

test('git refusing the deletes does not throw: the next tick retries (#1293)', async () => {
  const git = fakeGit({ local: true, remote: true, refuseDeletes: true })
  const outcome = await releaseStalePinnedBranch('/repo', BRANCH, { git: git.run, prs: async () => [pr('CLOSED')] })
  assert.equal(outcome, 'released')
  assert.deepEqual(git.deleted, [])
})
