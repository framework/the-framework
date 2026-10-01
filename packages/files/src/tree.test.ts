import { strict as assert } from 'node:assert'
import { execFileSync } from 'node:child_process'
import { mkdtemp, rm, writeFile, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import type { ModuleServerHost } from 'framework/module-server'
import { readAgentFileContent, readAgentFileDiff, readAgentTree, resolveAgentFiles } from './tree.js'

let dir: string
let root: string
const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()

/** The host for a run that has a checkout at `path`, and the record given, when one is. */
const inCheckout = (path: string, record?: { baseCommit?: string }): ModuleServerHost => ({
  root,
  run: async () => ({ checkout: path, ...(record ? { record } : {}), changedNothing: false }),
  mergeCommit: async () => ({ pending: false }),
})

/** A pull request on a run's branch, as the git host answers it. */
type Pr = { number: number; mergeCommit?: string } & Record<string, unknown>

/**
 * The host for a run with no checkout, the given record, and the given pull requests on its
 * branch. "Changed nothing" is the core's rule, as the core's host answers it: it ended `done` or
 * `failed` on this machine, with no pull request, and was not landed.
 */
function deps(agent: { status?: string; host?: string; branch?: string; pr?: { number: number }; baseCommit?: string; landed?: string }, prs: { value?: Pr[]; pending?: boolean } = {}): ModuleServerHost {
  return {
    root,
    run: async () => ({
      record: agent,
      changedNothing: !agent.pr && agent.landed === undefined && (agent.status === 'done' || agent.status === 'failed' || agent.status === 'stopped') && agent.host === 'this-machine',
    }),
    mergeCommit: async (_branch, number) => {
      if (prs.pending && prs.value === undefined) return { pending: true }
      const commit = prs.value?.find(pr => pr.number === number)?.mergeCommit
      return commit ? { pending: false, commit } : { pending: false }
    },
  }
}

/** Where the run with no checkout that `host` describes has its files. */
const resolve = (host: ModuleServerHost) => resolveAgentFiles(host, 'run-x', undefined, 'this-machine')

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

  const at = await resolveAgentFiles(inCheckout(path), 'run-live')
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

  const at = await resolve(deps({ branch: 'agent-local' }))
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

  const tree = await readAgentTree(root, await resolve(deps({ branch: 'agent-remote' })))
  assert.equal(tree.source, 'branch')
  if (tree.source === 'branch') assert.deepEqual(tree.changes, { 'g.txt': { status: 'added', committed: true } })
})

test('once the branch is gone, the squash commit its pull request merged as is read', async () => {
  git(root, 'checkout', '-q', 'main')
  const squash = commit(root, 'squash (#5)', { 'h.txt': 'h\n', 'a.txt': 'squashed\n' })

  const at = await resolve(deps({ branch: 'agent-squash', pr: { number: 5 } }, { value: [{ number: 5, url: 'u', state: 'MERGED', title: '', mergeCommit: squash }] }))
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
  const tree = await readAgentTree(root, await resolve(deps({ branch: 'agent-merged', pr: { number: 6 } }, pr)))
  assert.equal(tree.source, 'merge')
  if (tree.source === 'merge') assert.deepEqual(tree.changes, { 'i.txt': { status: 'added', committed: true } })

  const noPr = await resolve(deps({ branch: 'agent-merged' }))
  assert.equal(noPr.source, 'branch', 'with no merge commit to read, the branch still answers')
})

/** A run that finished on this machine. */
const endedHere = { status: 'done', host: 'this-machine' }

test('a run that finished here with no checkout, no branch and no pull request changed nothing, and the project reads with nothing marked', async () => {
  const at = await resolve(deps({ ...endedHere, branch: 'agent-committed-nothing' }))
  assert.deepEqual(at, { source: 'unchanged', ref: git(root, 'rev-parse', 'main') })
  const tree = await readAgentTree(root, at)
  assert.deepEqual(tree, { source: 'unchanged', files: git(root, 'ls-tree', '-r', '--name-only', 'main').split('\n'), changes: {} })
  assert.equal((await readAgentFileContent(root, at, 'a.txt'))?.text, git(root, 'show', 'main:a.txt'), 'a file reads as the default branch has it')
  assert.equal(await readAgentFileDiff(root, at, 'a.txt'), null, 'nothing changed, so nothing diffs')
  // A run that failed here was ended by its own tool too: its branch went with its checkout only because it held nothing.
  assert.deepEqual(await resolve(deps({ status: 'failed', host: 'this-machine', branch: 'agent-failed-before-work' })), at)
})

test('no checkout, no branch and no merge commit on this machine: gone', async () => {
  assert.deepEqual(await resolve(deps({ status: 'done', host: 'other-machine', branch: 'agent-never-pushed' })), { source: 'gone' }, 'a run from another machine: its branch may just not be here')
  for (const status of ['waiting']) {
    assert.deepEqual(await resolve(deps({ status, host: 'this-machine', branch: 'agent-renamed-away' })), { source: 'gone' }, `a ${status} run: its record may not name its branch's last name`)
  }
  assert.deepEqual(await resolve(deps({ status: 'done' })), { source: 'gone' }, 'a run that names no machine')
  const unfetched = { value: [{ number: 7, url: 'u', state: 'MERGED', title: '', mergeCommit: 'f'.repeat(40) }] }
  assert.deepEqual(await resolve(deps({ ...endedHere, branch: 'agent-gone', pr: { number: 7 } }, unfetched)), { source: 'gone' }, 'a merge commit this machine has not fetched')
  const other = { value: [{ number: 8, url: 'u', state: 'MERGED', title: '', mergeCommit: git(root, 'rev-parse', 'HEAD') }] }
  assert.deepEqual(await resolve(deps({ ...endedHere, branch: 'agent-gone', pr: { number: 7 } }, other)), { source: 'gone' }, 'another pull request on the branch is not this run’s')
  assert.deepEqual(await readAgentTree(root, { source: 'gone' }), { source: 'gone' })
})

test('a run starting here, in a project with no remote, reads the project HEAD its checkout is made from, nothing marked; one running elsewhere is pending', async () => {
  const head = git(root, 'rev-parse', 'HEAD')
  const unknown: ModuleServerHost = { root, run: async () => undefined, mergeCommit: async () => ({ pending: false }) }
  assert.deepEqual(await resolve(unknown), { source: 'starting', ref: head }, 'the page opened before the run wrote its record')
  assert.deepEqual(await resolve(deps({ status: 'running', host: 'this-machine' })), { source: 'starting', ref: head }, 'recorded, its checkout not made yet')
  assert.deepEqual(await resolve(deps({ status: 'running', host: 'other-machine', branch: 'agent-not-here' })), { source: 'pending' }, 'running elsewhere, its branch not here yet')
  const tree = await readAgentTree(root, { source: 'starting', ref: head })
  assert.deepEqual(tree, { source: 'starting', files: git(root, 'ls-tree', '-r', '--name-only', head).split('\n'), changes: {} })
})

test('a run starting here, in a project with a remote, reads origin’s default branch, never the branch the user has out', async () => {
  const project = join(dir, 'with-origin')
  execFileSync('git', ['init', '-q', '-b', 'main', project])
  git(project, 'config', 'user.email', 't@t')
  git(project, 'config', 'user.name', 't')
  const shared = commit(project, 'base', { 'a.txt': 'a\n' })
  execFileSync('git', ['init', '-q', '--bare', join(dir, 'with-origin.git')])
  git(project, 'remote', 'add', 'origin', join(dir, 'with-origin.git'))
  git(project, 'push', '-q', 'origin', 'main')
  git(project, 'checkout', '-q', '-b', 'my-feature')
  commit(project, 'unpushed', { 'secret.txt': 's\n' })
  const host: ModuleServerHost = { root: project, run: async () => undefined, mergeCommit: async () => ({ pending: false }) }
  assert.deepEqual(await resolveAgentFiles(host, 'run-x', undefined, 'this-machine'), { source: 'starting', ref: shared })
})

test('a checkout reclaimed since it was listed is no source: its branch is read, else pending, never an empty tree or a start', async () => {
  const gone = join(dir, 'reclaimed-checkout')
  const withGone = (record?: { status?: string; host?: string; branch?: string }): ModuleServerHost => ({
    root,
    run: async () => ({ checkout: gone, ...(record ? { record } : {}), changedNothing: false }),
    mergeCommit: async () => ({ pending: false }),
  })
  assert.deepEqual(await resolve(withGone()), { source: 'pending' }, 'no record yet')
  assert.deepEqual(await resolve(withGone({ status: 'running', host: 'this-machine' })), { source: 'pending' }, 'its record not caught up: it ended, it is not starting')
  git(root, 'branch', '-f', 'agent-reclaimed', 'HEAD')
  commit(root, 'on main after', { 'after.txt': 'x\n' })
  git(root, 'branch', '-f', 'agent-reclaimed', 'HEAD~1')
  assert.equal((await resolve(withGone({ status: 'running', host: 'this-machine', branch: 'agent-reclaimed' }))).source, 'branch', 'its branch, once named')
})

test('while the pull request is being looked up, the answer is pending', async () => {
  assert.deepEqual(await resolve(deps({ branch: 'agent-gone', pr: { number: 7 } }, { pending: true })), { source: 'pending' })
})

test('a deleted file on disk is not read as content', async () => {
  const path = join(dir, 'wt-del')
  git(root, 'worktree', 'add', '-q', '-b', 'agent-del', path)
  await unlink(join(path, 'c.txt'))
  const at = await resolveAgentFiles(inCheckout(path), 'run-del')
  assert.equal(await readAgentFileContent(root, at, 'c.txt'), null)
})

test('a run started from another run’s branch is measured from the commit its own work begins at: in its checkout, on its branch, and once it is landed and its branch gone', async () => {
  git(root, 'checkout', '-q', 'main')
  // A main agent's branch with work of its own, and a subagent's started from it.
  const mainPath = join(dir, 'wt-main-agent')
  git(root, 'worktree', 'add', '-q', '-b', 'agent-main-agent', mainPath, 'main')
  const start = commit(mainPath, 'the main agent’s work', { 'plan.txt': 'plan\n' })
  const subPath = join(dir, 'wt-subagent')
  git(root, 'worktree', 'add', '-q', '-b', 'agent-subagent', subPath, 'agent-main-agent')
  const tip = commit(subPath, 'the subagent’s part', { 'part.txt': 'part\n' })
  const own = { 'part.txt': { status: 'added', committed: true } }

  // In its checkout: without the commit on its record, the main agent's work reads as its own.
  const unknown = await readAgentTree(root, await resolveAgentFiles(inCheckout(subPath), 'run-sub'))
  assert.deepEqual(unknown.source === 'checkout' && Object.keys(unknown.changes).sort(), ['part.txt', 'plan.txt'])
  const live = await resolveAgentFiles(inCheckout(subPath, { baseCommit: start }), 'run-sub')
  const liveTree = await readAgentTree(root, live)
  assert.deepEqual(liveTree.source === 'checkout' && liveTree.changes, own)
  assert.equal(await readAgentFileDiff(root, live, 'plan.txt'), null, 'the main agent’s file is no change of this run')

  // On its branch, its checkout gone.
  git(root, 'worktree', 'remove', subPath)
  const onBranch = await resolve(deps({ status: 'done', host: 'this-machine', branch: 'agent-subagent', baseCommit: start }))
  assert.deepEqual(onBranch, { source: 'branch', branch: 'agent-subagent', ref: tip, base: start })
  const branchTree = await readAgentTree(root, onBranch)
  assert.deepEqual(branchTree.source === 'branch' && branchTree.changes, own)
  // A commit this machine does not have is no base: the default branch is.
  const elsewhere = await readAgentTree(root, await resolve(deps({ branch: 'agent-subagent', baseCommit: '0'.repeat(40) })))
  assert.deepEqual(elsewhere.source === 'branch' && Object.keys(elsewhere.changes).sort(), ['part.txt', 'plan.txt'])

  // Landed: merged into the main agent's branch, its own branch gone, its last commit kept and on its record.
  git(mainPath, 'merge', '-q', '--no-ff', '-m', 'Merge branch agent-subagent', 'agent-subagent')
  git(root, 'update-ref', 'refs/landed/run-sub', tip)
  git(root, 'branch', '-q', '-D', 'agent-subagent')
  const landed = await resolve(deps({ status: 'done', host: 'this-machine', baseCommit: start, landed: tip }))
  assert.deepEqual(landed, { source: 'landed', ref: tip, base: start })
  const landedTree = await readAgentTree(root, landed)
  assert.equal(landedTree.source, 'landed')
  if (landedTree.source !== 'landed') return
  assert.deepEqual(landedTree.changes, own)
  assert.ok(landedTree.files.includes('part.txt') && landedTree.files.includes('plan.txt'), 'the whole tree at its last commit')
  assert.match((await readAgentFileDiff(root, landed, 'part.txt'))?.patch ?? '', /\+part/)
  assert.deepEqual(await readAgentFileContent(root, landed, 'plan.txt'), { path: 'plan.txt', text: 'plan', truncated: false, binary: false })

  // The main agent's branch squashed and deleted later changes nothing: the kept ref holds the commit.
  git(root, 'worktree', 'remove', mainPath)
  git(root, 'branch', '-q', '-D', 'agent-main-agent')
  assert.deepEqual(await readAgentTree(root, await resolve(deps({ status: 'done', host: 'this-machine', baseCommit: start, landed: tip }))), landedTree)

  // A landed run whose commit this machine does not have is gone, never "changed nothing".
  assert.deepEqual(await resolve(deps({ status: 'done', host: 'this-machine', landed: '0'.repeat(40) })), { source: 'gone' })
})
