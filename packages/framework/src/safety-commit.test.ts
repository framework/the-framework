import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { promisify } from 'node:util'
import type { GitRunner } from './project.js'
import { nodeGitRunner } from './project.js'
import { SAFETY_COMMIT_LIMITS, SAFETY_COMMIT_MESSAGE, SafetyCommitRefused, parsePendingPaths, pendingWork, safetyCommit, sweepRefusal } from './safety-commit.js'

/** `git status --porcelain -uall -z` output for these entries. */
const porcelain = (...entries: string[]): string => entries.map(e => `${e}\0`).join('')

/** A git that answers `status` with `status`, records everything else. */
function fakeGit(status: string) {
  const calls: string[][] = []
  const git: GitRunner = async args => {
    calls.push(args)
    return args[0] === 'status' ? status : ''
  }
  return { git, calls }
}

test('parsePendingPaths reads NUL-separated paths and skips the original of a rename (#1638)', () => {
  const out = porcelain(' M src/a.ts', '?? .turbo/cache/x', 'R  new.txt', 'old.txt', '?? sp ace.txt', ' D gone.md')
  assert.deepEqual(parsePendingPaths(out), ['src/a.ts', '.turbo/cache/x', 'new.txt', 'sp ace.txt', 'gone.md'])
  assert.deepEqual(parsePendingPaths(''), [])
})

test('pendingWork counts files per top-level directory and sums sizes (#1638)', async () => {
  const { git, calls } = fakeGit(porcelain(' M a.ts', '?? .turbo/cache/1', '?? .turbo/cache/2', ' D docs/gone.md'))
  const work = await pendingWork(git, '/repo', SAFETY_COMMIT_LIMITS, async path => (path.endsWith('gone.md') ? 0 : 10))
  assert.equal(work.files, 4)
  assert.equal(work.bytes, 30, 'a deleted file weighs nothing')
  assert.deepEqual(work.byTopDir, [['.turbo', 2], ['', 1], ['docs', 1]])
  assert.deepEqual(calls, [['status', '--porcelain', '-uall', '-z']], 'every untracked file listed, unquoted')
})

test('pendingWork does not read sizes past the file limit: the count alone refuses (#1638)', async () => {
  const { git } = fakeGit(porcelain(...Array.from({ length: 5 }, (_, i) => `?? .turbo/${i}`)))
  let reads = 0
  const work = await pendingWork(git, '/repo', { files: 4, bytes: 1 }, async () => (reads++, 100))
  assert.equal(work.files, 5)
  assert.equal(reads, 0, 'thousands of pending files is exactly where thousands of stats would cost')
})

test('sweepRefusal says how much and where, and is silent within both limits (#1638)', () => {
  const limits = { files: 200, bytes: 20 * 1024 * 1024 }
  assert.equal(sweepRefusal({ files: 3, bytes: 4096, byTopDir: [['', 3]] }, limits), undefined)
  const many = sweepRefusal({ files: 7632, bytes: 0, byTopDir: [['.turbo', 7630], ['', 2]] }, limits)
  assert.match(many ?? '', /refused to commit 7,632 pending files/)
  assert.match(many ?? '', /mostly under \.turbo\/ \(7,630 files\), the repository root \(2 files\)/)
  assert.match(many ?? '', /Commit or ignore them yourself, then retry/)
  const big = sweepRefusal({ files: 2, bytes: 262 * 1024 * 1024, byTopDir: [['dump', 2]] }, limits)
  assert.match(big ?? '', /2 pending files, 262 MB/)
  assert.match(big ?? '', /the limit is 200 files or 20 MB/)
})

test('safetyCommit stages and commits pending work within the limits (#1638)', async () => {
  const { git, calls } = fakeGit(porcelain(' M a.ts'))
  assert.equal(await safetyCommit(git, '/repo', { size: async () => 10 }), 'committed')
  assert.deepEqual(calls.slice(1), [['add', '-A'], ['commit', '-m', SAFETY_COMMIT_MESSAGE]])
})

test('safetyCommit on a clean checkout commits nothing and says so (#1638)', async () => {
  const { git, calls } = fakeGit('')
  assert.equal(await safetyCommit(git, '/repo'), 'clean')
  assert.equal(calls.length, 1)
})

test('safetyCommit refuses an implausible sweep before touching the index (#1638)', async () => {
  const { git, calls } = fakeGit(porcelain(...Array.from({ length: 201 }, (_, i) => `?? .next/cache/${i}`)))
  await assert.rejects(safetyCommit(git, '/repo'), (err: unknown) => err instanceof SafetyCommitRefused && /201 pending files/.test(err.message))
  assert.deepEqual(calls.map(c => c[0]), ['status'], 'no add, no commit')
  const heavy = fakeGit(porcelain('?? dump.sql'))
  await assert.rejects(safetyCommit(heavy.git, '/repo', { size: async () => 30 * 1024 * 1024 }), SafetyCommitRefused)
  assert.deepEqual(heavy.calls.map(c => c[0]), ['status'], 'one big file is refused on bytes, not count')
})

test('against a real repo: a cache directory past the limit is refused and left uncommitted, ordinary edits are committed (#1638)', async () => {
  const repo = await mkdtemp(join(tmpdir(), 'framework-safety-'))
  const run = promisify(execFile)
  const git = nodeGitRunner()
  try {
    await run('git', ['init', '-q', '-b', 'main'], { cwd: repo })
    await run('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'root'], { cwd: repo })
    await mkdir(join(repo, '.turbo', 'cache'), { recursive: true })
    for (let i = 0; i < 5; i++) await writeFile(join(repo, '.turbo', 'cache', `${i}.bin`), 'x'.repeat(100))
    await writeFile(join(repo, 'notes.md'), 'a real edit\n')
    // Six pending files against a limit of five: refused, and git still sees all six pending.
    await assert.rejects(safetyCommit(git, repo, { limits: { files: 5, bytes: SAFETY_COMMIT_LIMITS.bytes } }), (err: unknown) => err instanceof SafetyCommitRefused && /\.turbo\/ \(5 files\)/.test(err.message))
    assert.equal(parsePendingPaths(await git(['status', '--porcelain', '-uall', '-z'], repo)).length, 6, 'nothing was staged or committed')
    // The same tree within a bigger limit is committed whole, on the real sizes.
    const gitWithIdentity: GitRunner = (args, cwd) => git(['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], cwd)
    assert.equal(await safetyCommit(gitWithIdentity, repo, { limits: { files: 6, bytes: 1024 } }), 'committed')
    assert.equal((await git(['status', '--porcelain', '-uall', '-z'], repo)).length, 0)
    assert.equal((await git(['log', '-1', '--format=%s'], repo)).trim(), SAFETY_COMMIT_MESSAGE)
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})
