import { strict as assert } from 'node:assert'
import { execFileSync } from 'node:child_process'
import { mkdtemp, rm, writeFile, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import type { BranchesFor, BranchesSource, Checkout } from '../store/branches.js'
import type { LinkedPr } from './pull-requests.js'
import { readAgentFileContent, readAgentFileDiff, readAgentTree, resolveAgentFiles, type AgentFilesDeps } from './agent-tree.js'

let dir: string
let root: string
const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()

/** A branches provider that lists the given checkouts and nothing else. */
const listing = (checkouts: Checkout[]): BranchesFor => async () => ({ list: async () => checkouts }) as unknown as BranchesSource
const noCheckout = listing([])

/** The deps for a run with no checkout, the given record, and the given pull requests on its branch. */
function deps(agent: { branch?: string; pr?: { number: number } }, prs: { value?: LinkedPr[]; pending?: boolean } = {}): AgentFilesDeps {
  return {
    branches: noCheckout,
    agent: async (_root, id) => ({ id, ...agent }),
    prs: async () => ({ value: prs.value, pending: prs.pending ?? false }),
  }
}

/** Commit a change on the current branch of `cwd`: files written, files removed. */
function commit(cwd: string, message: string, write: Record<string, string>, remove: string[] = []): string {
  for (const [path, text] of Object.entries(write)) execFileSync('sh', ['-c', `mkdir -p "$(dirname '${path}')" && printf '%s' '${text}' > '${path}'`], { cwd })
  for (const path of remove) git(cwd, 'rm', '-q', path)
  git(cwd, 'add', '-A')
  git(cwd, 'commit', '-q', '-m', message)
  return git(cwd, 'rev-parse', 'HEAD')
}

before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'agent-tree-'))
  root = join(dir, 'repo')
  execFileSync('git', ['init', '-q', '-b', 'main', root])
  git(root, 'config', 'user.email', 't@t')
  git(root, 'config', 'user.name', 't')
  commit(root, 'base', { 'a.txt': 'a\n', 'c.txt': 'c\n', 'src/d.txt': 'd\n' })
})
after(() => rm(dir, { recursive: true, force: true }))

test('a live checkout marks committed and uncommitted changes apart, the uncommitted mark winning', async () => {
  const path = join(dir, 'wt-live')
  git(root, 'worktree', 'add', '-q', '-b', 'agent-live', path)
  commit(path, 'work', { 'a.txt': 'a2\n', 'b.txt': 'b\n' }, ['c.txt'])
  await writeFile(join(path, 'b.txt'), 'b edited\n')
  await writeFile(join(path, 'src/d.txt'), 'd2\n')
  await writeFile(join(path, 'e.txt'), 'new\n')

  const at = await resolveAgentFiles(root, 'run-live', { branches: listing([{ id: 'run-live', path }]) })
  assert.equal(at.source, 'checkout')
  const tree = await readAgentTree(root, at)
  assert.equal(tree.source, 'checkout')
  if (tree.source !== 'checkout') return
  assert.deepEqual(tree.files, ['a.txt', 'b.txt', 'c.txt', 'e.txt', 'src/d.txt'], 'the committed deletion stays listed')
  assert.deepEqual(tree.changes, {
    'a.txt': { status: 'modified', committed: true },
    'b.txt': { status: 'modified', committed: false },
    'c.txt': { status: 'deleted', committed: true },
    'e.txt': { status: 'untracked', committed: false },
    'src/d.txt': { status: 'modified', committed: false },
  })

  const committed = await readAgentFileDiff(root, at, 'a.txt')
  assert.match(committed?.patch ?? '', /-a\n\+a2/, 'a committed file diffs from the fork point')
  const pending = await readAgentFileDiff(root, at, 'src/d.txt')
  assert.match(pending?.patch ?? '', /-d\n\+d2/, 'an uncommitted file diffs against its last commit')
  assert.equal(await readAgentFileDiff(root, at, 'README.md'), null)
})

test('with no checkout, the local branch is read by ref', async () => {
  git(root, 'branch', 'agent-local', 'main')
  const path = join(dir, 'wt-local')
  git(root, 'worktree', 'add', '-q', path, 'agent-local')
  commit(path, 'work', { 'a.txt': 'local\n', 'f.txt': 'f\n' }, ['src/d.txt'])
  git(root, 'worktree', 'remove', path)

  const at = await resolveAgentFiles(root, 'run-local', deps({ branch: 'agent-local' }))
  assert.equal(at.source, 'branch')
  const tree = await readAgentTree(root, at)
  assert.deepEqual(tree, {
    source: 'branch',
    branch: 'agent-local',
    files: ['a.txt', 'c.txt', 'f.txt', 'src/d.txt'],
    changes: {
      'a.txt': { status: 'modified', committed: true },
      'f.txt': { status: 'added', committed: true },
      'src/d.txt': { status: 'deleted', committed: true },
    },
  })
  assert.match((await readAgentFileDiff(root, at, 'a.txt'))?.patch ?? '', /-a\n\+local/)
  assert.deepEqual(await readAgentFileContent(root, at, 'f.txt'), { path: 'f.txt', text: 'f', truncated: false, binary: false })
  assert.equal(await readAgentFileContent(root, at, '../x'), null, 'an unsafe path is refused')
})

test('a branch only origin holds is read from its remote-tracking ref', async () => {
  git(root, 'branch', 'agent-remote', 'main')
  const path = join(dir, 'wt-remote')
  git(root, 'worktree', 'add', '-q', path, 'agent-remote')
  const tip = commit(path, 'work', { 'g.txt': 'g\n' })
  git(root, 'worktree', 'remove', path)
  git(root, 'update-ref', 'refs/remotes/origin/agent-remote', tip)
  git(root, 'branch', '-q', '-D', 'agent-remote')

  const tree = await readAgentTree(root, await resolveAgentFiles(root, 'run-remote', deps({ branch: 'agent-remote' })))
  assert.equal(tree.source, 'branch')
  if (tree.source === 'branch') assert.deepEqual(tree.changes, { 'g.txt': { status: 'added', committed: true } })
})

test('once the branch is gone, the squash commit its pull request merged as is read', async () => {
  git(root, 'checkout', '-q', 'main')
  const squash = commit(root, 'squash (#5)', { 'h.txt': 'h\n', 'a.txt': 'squashed\n' })

  const at = await resolveAgentFiles(root, 'run-squash', deps({ branch: 'agent-squash', pr: { number: 5 } }, { value: [{ number: 5, url: 'u', state: 'MERGED', title: '', mergeCommit: squash }] }))
  assert.deepEqual(at, { source: 'merge', number: 5, ref: squash, base: git(root, 'rev-parse', `${squash}^1`) })
  const tree = await readAgentTree(root, at)
  assert.equal(tree.source, 'merge')
  if (tree.source === 'merge') {
    assert.equal(tree.number, 5)
    assert.deepEqual(tree.changes, { 'a.txt': { status: 'modified', committed: true }, 'h.txt': { status: 'added', committed: true } })
  }
  assert.deepEqual(await readAgentFileContent(root, at, 'h.txt'), { path: 'h.txt', text: 'h', truncated: false, binary: false })
})

test('a branch the default branch already contains (a true merge) reads its merge commit instead', async () => {
  git(root, 'checkout', '-q', '-b', 'agent-merged')
  commit(root, 'work', { 'i.txt': 'i\n' })
  git(root, 'checkout', '-q', 'main')
  git(root, 'merge', '-q', '--no-ff', '-m', 'merge (#6)', 'agent-merged')
  const merge = git(root, 'rev-parse', 'HEAD')

  const pr = { value: [{ number: 6, url: 'u', state: 'MERGED', title: '', mergeCommit: merge }] }
  const tree = await readAgentTree(root, await resolveAgentFiles(root, 'run-merged', deps({ branch: 'agent-merged', pr: { number: 6 } }, pr)))
  assert.equal(tree.source, 'merge')
  if (tree.source === 'merge') assert.deepEqual(tree.changes, { 'i.txt': { status: 'added', committed: true } })

  const noPr = await resolveAgentFiles(root, 'run-merged', deps({ branch: 'agent-merged' }))
  assert.equal(noPr.source, 'branch', 'with no merge commit to read, the branch still answers')
})

test('no checkout, no branch and no merge commit on this machine: gone', async () => {
  assert.deepEqual(await resolveAgentFiles(root, 'run-x', deps({ branch: 'agent-never-pushed' })), { source: 'gone' })
  assert.deepEqual(await resolveAgentFiles(root, 'run-x', deps({})), { source: 'gone' }, 'a run that recorded no branch')
  const unfetched = { value: [{ number: 7, url: 'u', state: 'MERGED', title: '', mergeCommit: 'f'.repeat(40) }] }
  assert.deepEqual(await resolveAgentFiles(root, 'run-x', deps({ branch: 'agent-gone', pr: { number: 7 } }, unfetched)), { source: 'gone' }, 'a merge commit this machine has not fetched')
  const other = { value: [{ number: 8, url: 'u', state: 'MERGED', title: '', mergeCommit: git(root, 'rev-parse', 'HEAD') }] }
  assert.deepEqual(await resolveAgentFiles(root, 'run-x', deps({ branch: 'agent-gone', pr: { number: 7 } }, other)), { source: 'gone' }, 'another pull request on the branch is not this run’s')
  assert.deepEqual(await readAgentTree(root, { source: 'gone' }), { source: 'gone' })
})

test('while the pull request is being looked up, the answer is pending', async () => {
  assert.deepEqual(await resolveAgentFiles(root, 'run-x', deps({ branch: 'agent-gone', pr: { number: 7 } }, { pending: true })), { source: 'pending' })
})

test('a deleted file on disk is not read as content', async () => {
  const path = join(dir, 'wt-del')
  git(root, 'worktree', 'add', '-q', '-b', 'agent-del', path)
  await unlink(join(path, 'c.txt'))
  const at = await resolveAgentFiles(root, 'run-del', { branches: listing([{ id: 'run-del', path }]) })
  assert.equal(await readAgentFileContent(root, at, 'c.txt'), null)
})
