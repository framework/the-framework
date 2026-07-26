import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { promoteQueue } from './queue-promote.js'
import type { GitRunner } from './project.js'

// Pins the retry contract auto PM acts on: the callee flags the one retryable skip, so the
// daemon never has to string-match the prose reason (which a copyedit would silently break).

test('a dirty queue file is the one retryable skip (#852/#855)', async () => {
  const git: GitRunner = async args => {
    if (args[0] === 'show' && String(args[1]).startsWith('work:')) return '- queue entry\n'
    if (args[0] === 'show') return '- older entry\n'
    if (args[0] === 'status') return ' M TODO_AGENTS.md\n'
    throw new Error(`unexpected git ${args.join(' ')}`)
  }
  const outcome = await promoteQueue('/repo', { id: 'r1', branch: 'work' }, git)
  assert.deepEqual(outcome, { promoted: false, reason: 'the checkout has uncommitted queue changes', retry: true })
})

test('a run with no branch, or no queue file on it, is a final skip (no retry flag)', async () => {
  const noBranch = await promoteQueue('/repo', { id: 'r1' })
  assert.equal(noBranch.promoted, false)
  assert.ok(!('retry' in noBranch && noBranch.retry), 'no branch is final')

  const git: GitRunner = async args => {
    if (args[0] === 'show') throw new Error('path does not exist')
    throw new Error(`unexpected git ${args.join(' ')}`)
  }
  const noFile = await promoteQueue('/repo', { id: 'r1', branch: 'work' }, git)
  assert.equal(noFile.promoted, false)
  assert.ok(!('retry' in noFile && noFile.retry), 'no queue file is final')
})

/** A repo whose branch, checkout, and fork-point queues are given, recording what gets run. */
function fakeRepo(files: { branch: string; checkout: string; base?: string }) {
  const written: Record<string, string> = {}
  const commands: string[][] = []
  const git: GitRunner = async args => {
    commands.push(args)
    if (args[0] === 'show' && String(args[1]).startsWith('work:')) return files.branch
    if (args[0] === 'show' && String(args[1]).startsWith('HEAD:')) return files.checkout
    if (args[0] === 'show' && String(args[1]).startsWith('fork0000:')) {
      if (files.base === undefined) throw new Error('path does not exist')
      return files.base
    }
    if (args[0] === 'status') return ''
    if (args[0] === 'merge-base') return 'fork0000\n'
    if (args[0] === 'checkout' || args[0] === 'add' || args[0] === 'commit') return ''
    throw new Error(`unexpected git ${args.join(' ')}`)
  }
  const write = async (path: string, content: string) => {
    written[path] = content
  }
  const ran = (name: string) => commands.filter(args => args[0] === name)
  return { git, write, written, ran }
}

test("a checkout that moved since the fork gets the run's changes merged on, not the wholesale copy (#1204)", async () => {
  // Two agents forked the same queue; the other one's promotion landed "a" first. This run's
  // wholesale copy would have re-opened it — the exact loop that made concurrent drains redo work.
  const repo = fakeRepo({
    base: '- [ ] a\n- [ ] b\n',
    checkout: '- [x] a\n- [ ] b\n',
    branch: '- [ ] a\n- [x] b\n',
  })
  const outcome = await promoteQueue('/repo', { id: 'r1', branch: 'work' }, repo.git, repo.write)
  assert.deepEqual(outcome, { promoted: true, branch: 'work' })
  assert.equal(repo.written['/repo/TODO_AGENTS.md'], '- [x] a\n- [x] b\n')
  assert.equal(repo.ran('commit').length, 1)
  assert.equal(repo.ran('checkout').length, 0, 'the merge path must not also copy the branch file over')
})

test('an unmoved checkout keeps the exact wholesale copy (#852)', async () => {
  // The common serial case: nothing landed since the fork, so the run's file is strictly newer
  // and `git checkout <branch> -- <file>` reproduces it byte for byte.
  const repo = fakeRepo({
    base: '- [ ] a\n',
    checkout: '- [ ] a\n',
    branch: '- [x] a\n',
  })
  const outcome = await promoteQueue('/repo', { id: 'r1', branch: 'work' }, repo.git, repo.write)
  assert.deepEqual(outcome, { promoted: true, branch: 'work' })
  assert.deepEqual(repo.written, {}, 'nothing is hand-written on the copy path')
  assert.equal(repo.ran('checkout').length, 1)
  assert.equal(repo.ran('commit').length, 1)
})

test('a fork point git cannot name falls back to the wholesale copy (#1204)', async () => {
  const repo = fakeRepo({
    checkout: '- [ ] a\n',
    branch: '- [x] a\n',
  })
  const git: GitRunner = async args =>
    args[0] === 'merge-base' ? Promise.reject(new Error('no common ancestor')) : repo.git(args, '/repo')
  const outcome = await promoteQueue('/repo', { id: 'r1', branch: 'work' }, git, repo.write)
  assert.deepEqual(outcome, { promoted: true, branch: 'work' })
  assert.deepEqual(repo.written, {})
  assert.equal(repo.ran('checkout').length, 1)
})

test('a run whose queue changes all landed already is a final skip (#1204)', async () => {
  // The checkout moved past the run: everything it did is already in. Committing an identical
  // file would fail; skipping quietly settles the run instead.
  const repo = fakeRepo({
    base: '- [ ] a\n',
    checkout: '- [x] a\n- [ ] queued meanwhile\n',
    branch: '- [x] a\n',
  })
  const outcome = await promoteQueue('/repo', { id: 'r1', branch: 'work' }, repo.git, repo.write)
  assert.equal(outcome.promoted, false)
  assert.ok(!('retry' in outcome && outcome.retry), 'nothing to land is final')
  assert.deepEqual(repo.written, {})
  assert.equal(repo.ran('commit').length, 0)
})
