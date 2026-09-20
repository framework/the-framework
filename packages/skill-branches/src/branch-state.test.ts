import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { nodeGitRunner } from '@gemstack/agent-data'
import { createCheckout } from './checkout.js'
import { parseCommits, parseNumstat, parsePorcelain, readBranchStates } from './branch-state.js'
import { runCli } from './cli.js'

// What a branch holds and where it stands (#1774): the caller's read of a finished agent's
// work. Real git, a bare origin; no gh, since the pull request is the caller's own question.

const git = nodeGitRunner()

/** A repo with one commit pushed to a bare `origin`, whose HEAD names `main`. */
async function repoWithOrigin(): Promise<string> {
  const base = await realpath(await mkdtemp(join(tmpdir(), 'branches-state-')))
  const repo = join(base, 'repo')
  await mkdir(repo)
  await git(['init', '-q', '-b', 'main'], repo)
  await git(['config', 'user.email', 't@t'], repo)
  await git(['config', 'user.name', 't'], repo)
  await writeFile(join(repo, 'index.html'), '<h1>Hello</h1>\n')
  await git(['add', '-A'], repo)
  await git(['commit', '-q', '-m', 'init'], repo)
  await git(['init', '-q', '--bare', join(base, 'origin.git')], base)
  await git(['remote', 'add', 'origin', join(base, 'origin.git')], repo)
  await git(['push', '-q', '-u', 'origin', 'main'], repo)
  await git(['remote', 'set-head', 'origin', 'main'], repo)
  return repo
}

async function commit(path: string, file: string, content: string, message: string): Promise<void> {
  await writeFile(join(path, file), content)
  await git(['config', 'user.email', 't@t'], path)
  await git(['config', 'user.name', 't'], path)
  await git(['add', '-A'], path)
  await git(['commit', '-q', '-m', message], path)
}

test('show: the commits and files beyond the base, whether the remote has the tip, and what the checkout left uncommitted', async () => {
  const repo = await repoWithOrigin()
  try {
    const { path } = await createCheckout(repo, { agentId: 'a1' })
    await commit(path, 'index.html', '<h1>Welcome</h1>\nmore\n', 'welcome')
    await commit(path, 'notes.md', 'notes\n', 'notes')
    await writeFile(join(path, 'draft.txt'), 'not committed\n')
    const [state] = await readBranchStates(repo, ['agent-a1'], git)
    assert.ok(state)
    assert.equal(state.branch, 'agent-a1')
    assert.equal(state.exists, true)
    assert.equal(state.base, 'origin/main')
    assert.deepEqual(state.commits.map(c => c.subject), ['notes', 'welcome'], 'newest first')
    assert.match(state.commits[0]!.sha, /^[0-9a-f]{40}$/)
    assert.deepEqual(state.files, [
      { path: 'index.html', insertions: 2, deletions: 1, binary: false },
      { path: 'notes.md', insertions: 1, deletions: 0, binary: false },
    ])
    assert.equal(state.hasRemote, true)
    assert.equal(state.pushed, false, 'nothing pushed yet')
    assert.equal(state.merged, false)
    assert.deepEqual(state.pendingFiles, ['draft.txt'], 'the checkout on the branch names its uncommitted work')

    await rm(join(path, 'draft.txt'))
    await git(['push', '-q', 'origin', 'agent-a1'], path)
    const [pushed] = await readBranchStates(repo, ['agent-a1'], git)
    assert.equal(pushed!.pushed, true, 'the remote has the tip')
    assert.deepEqual(pushed!.pendingFiles, [], 'asked, and the tree is clean')

    // Landed on main: the base contains it, and it holds nothing beyond the base any more.
    await git(['merge', '-q', '--no-ff', '-m', 'land', 'agent-a1'], repo)
    await git(['push', '-q', 'origin', 'main'], repo)
    const [merged] = await readBranchStates(repo, ['agent-a1'], git)
    assert.equal(merged!.merged, true)
    assert.deepEqual(merged!.commits, [])
    assert.deepEqual(merged!.files, [])
  } finally {
    await rm(join(repo, '..'), { recursive: true, force: true, maxRetries: 10 })
  }
})

test('show: several branches answer in the order asked; a branch that is gone answers exists false with empty lists', async () => {
  const repo = await repoWithOrigin()
  try {
    const { path } = await createCheckout(repo, { agentId: 'a2' })
    await commit(path, 'index.html', '<h1>Two</h1>\n', 'two')
    const states = await readBranchStates(repo, ['nope', 'agent-a2', 'main'], git)
    assert.deepEqual(
      states.map(s => [s.branch, s.exists, s.commits.length]),
      [
        ['nope', false, 0],
        ['agent-a2', true, 1],
        ['main', true, 0],
      ],
    )
    assert.deepEqual(states[0], { branch: 'nope', exists: false, commits: [], files: [], hasRemote: true, pushed: false, merged: false })
    assert.equal('pendingFiles' in states[2]!, false, 'no checkout is on main: nobody asked')

    // The command line: a bare JSON array, one element per branch named.
    const out: string[] = []
    const code = await runCli(['show', 'agent-a2', 'nope'], { cwd: path, stdout: l => out.push(l), stderr: () => {} }, git)
    assert.equal(code, 0)
    const printed = JSON.parse(out.join('')) as { branch: string; exists: boolean }[]
    assert.deepEqual(
      printed.map(s => [s.branch, s.exists]),
      [
        ['agent-a2', true],
        ['nope', false],
      ],
    )
    const usage: string[] = []
    assert.equal(await runCli(['show'], { cwd: repo, stdout: () => {}, stderr: l => usage.push(l) }, git), 2, 'at least one branch')
    assert.match(usage.join('\n'), /at least 1/)
  } finally {
    await rm(join(repo, '..'), { recursive: true, force: true, maxRetries: 10 })
  }
})

test('show: a repository with no remote has no remote and nothing pushed; without a default branch, no base, no commits and no files', async () => {
  const repo = await realpath(await mkdtemp(join(tmpdir(), 'branches-state-')))
  try {
    await git(['init', '-q', '-b', 'trunk'], repo)
    await commit(repo, 'a.txt', 'a\n', 'a')
    await git(['switch', '-q', '-c', 'agent-x'], repo)
    await commit(repo, 'b.txt', 'b\n', 'b')
    const [state] = await readBranchStates(repo, ['agent-x'], git)
    assert.deepEqual(state, { branch: 'agent-x', exists: true, commits: [], files: [], hasRemote: false, pushed: false, merged: false })
  } finally {
    await rm(repo, { recursive: true, force: true, maxRetries: 10 })
  }
})

test('the parsers: a subject with spaces, a binary numstat entry, a renamed and a quoted status path', () => {
  const SEP = String.fromCharCode(31)
  assert.deepEqual(parseCommits(`abc${SEP}one two\n\ndef${SEP}\n`), [
    { sha: 'abc', subject: 'one two' },
    { sha: 'def', subject: '' },
  ])
  assert.deepEqual(parseNumstat('3\t1\ta.ts\n-\t-\timg.png\n\n'), [
    { path: 'a.ts', insertions: 3, deletions: 1, binary: false },
    { path: 'img.png', insertions: 0, deletions: 0, binary: true },
  ])
  assert.deepEqual(parsePorcelain(' M a.ts\n?? new.txt\nR  old.txt -> new name.txt\n M "sp ace.txt"\n'), ['a.ts', 'new.txt', 'new name.txt', 'sp ace.txt'])
})
