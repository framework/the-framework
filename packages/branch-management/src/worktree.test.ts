import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { join } from 'node:path'
import { mkdir, mkdtemp, rm, writeFile, stat, realpath, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { nodeGitRunner, type GitRunner } from './git.js'
import {
  nameBranch,
  addWorktree,
  attachWorktree,
  deleteBranch,
  isWorktreeRoot,
  worktreeBranch,
  listWorktrees,
  parseWorktreeList,
  removeWorktree,
  pruneWorktrees,
  worktreeClean,
  worktreePath,
  currentBranch,
  listWorktreeDirs,
} from './worktree.js'
import { agentBranchName, BRANCHES_DIR } from './branch-names.js'

const REPO = '/repo'

/** A {@link GitRunner} that records its calls and returns a canned stdout. */
function recordingGit(stdout = ''): GitRunner & { calls: { args: string[]; cwd: string }[] } {
  const calls: { args: string[]; cwd: string }[] = []
  const agent: GitRunner = async (args, cwd) => {
    calls.push({ args, cwd })
    return stdout
  }
  return Object.assign(agent, { calls })
}

const failingGit: GitRunner = async () => {
  throw new Error('not a git repository')
}

test('worktreePath nests the checkout under .branches/, named as its branch (#1580)', () => {
  assert.equal(worktreePath(REPO, '2026-07-19T10-00-00-000Z'), join(REPO, BRANCHES_DIR, 'agent-2026-07-19T10-00-00-000Z'))
})

test('addWorktree builds `worktree add -b <branch> <path>` and returns the path + branch', async () => {
  const git = recordingGit()
  const added = await addWorktree(REPO, { agentId: 'run1', branch: 'agent-run1' }, git)
  const path = worktreePath(REPO, 'run1')
  assert.deepEqual(added, { path, branch: 'agent-run1' })
  assert.deepEqual(git.calls, [{ args: ['worktree', 'add', '-b', 'agent-run1', path], cwd: REPO }])
})

test('addWorktree appends the base ref when given', async () => {
  const git = recordingGit()
  await addWorktree(REPO, { agentId: 'run1', branch: 'b', base: 'origin/main' }, git)
  assert.deepEqual(git.calls[0]?.args, ['worktree', 'add', '-b', 'b', worktreePath(REPO, 'run1'), 'origin/main'])
})

test('addWorktree rejects an unsafe run id before touching git (no traversal out of worktrees/)', async () => {
  const git = recordingGit()
  await assert.rejects(() => addWorktree(REPO, { agentId: '../evil', branch: 'b' }, git), /unsafe run id/)
  assert.equal(git.calls.length, 0)
})

test('parseWorktreeList reads path/head/branch and strips refs/heads/, dropping detached branches', () => {
  const porcelain = [
    'worktree /repo',
    'HEAD aaaa',
    'branch refs/heads/main',
    '',
    'worktree /repo/.branches/agent-run1',
    'HEAD bbbb',
    'branch refs/heads/agent-run1',
    '',
    'worktree /repo/detached',
    'HEAD cccc',
    'detached',
    '',
  ].join('\n')
  assert.deepEqual(parseWorktreeList(porcelain), [
    { path: '/repo', head: 'aaaa', branch: 'main' },
    { path: '/repo/.branches/agent-run1', head: 'bbbb', branch: 'agent-run1' },
    { path: '/repo/detached', head: 'cccc' },
  ])
})

test('parseWorktreeList yields [] for empty output', () => {
  assert.deepEqual(parseWorktreeList(''), [])
})

test('listWorktrees passes --porcelain and is forgiving of a git failure', async () => {
  const git = recordingGit('worktree /repo\nHEAD aaaa\nbranch refs/heads/main\n')
  const entries = await listWorktrees(REPO, git)
  assert.deepEqual(git.calls[0]?.args, ['worktree', 'list', '--porcelain'])
  assert.deepEqual(entries, [{ path: '/repo', head: 'aaaa', branch: 'main' }])
  assert.deepEqual(await listWorktrees(REPO, failingGit), [])
})

test('removeWorktree tolerates an already-gone path', async () => {
  // Both attempts fail for a path git never registered; teardown stays idempotent.
  await assert.doesNotReject(() => removeWorktree(REPO, '/repo/gone', failingGit))
})

test('pruneWorktrees runs `worktree prune` and tolerates failure', async () => {
  const git = recordingGit()
  await pruneWorktrees(REPO, git)
  assert.deepEqual(git.calls[0]?.args, ['worktree', 'prune'])
  await assert.doesNotReject(() => pruneWorktrees(REPO, failingGit))
})

// End-to-end against real git: the whole point of the module is that the plumbing
// works, so add -> list -> remove -> prune is exercised on a temp repo.
test('add/list/remove round-trips against a real git repo', async () => {
  const git = nodeGitRunner()
  // realpath so the mkdtemp path matches what `git worktree list` reports: on
  // macOS tmpdir is under the /var -> /private/var symlink (same gotcha as
  // enumerateGitRepos in install.ts).
  const repo = await realpath(await mkdtemp(join(tmpdir(), 'worktree-')))
  try {
    await git(['init'], repo)
    await git(['config', 'user.email', 't@t'], repo)
    await git(['config', 'user.name', 't'], repo)
    await writeFile(join(repo, 'README.md'), '# t\n')
    await git(['add', '-A'], repo)
    await git(['commit', '-m', 'init'], repo)

    const { path, branch } = await addWorktree(repo, { agentId: 'run1', branch: 'agent-run1' }, git)
    assert.equal((await stat(path)).isDirectory(), true, 'worktree checkout dir exists')
    assert.equal((await stat(join(path, 'README.md'))).isFile(), true, 'checkout has the repo content')

    const listed = await listWorktrees(repo, git)
    assert.ok(listed.some(w => w.path === path && w.branch === branch), 'new worktree shows up with its branch')

    await removeWorktree(repo, path, git)
    await assert.rejects(() => stat(path), 'checkout dir is gone after removal')
    assert.equal((await listWorktrees(repo, git)).some(w => w.path === path), false, 'removed worktree is no longer listed')

    await assert.doesNotReject(() => pruneWorktrees(repo, git))
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})

test('attachWorktree recreates a branch that is gone from HEAD, and still refuses one git will not attach (#1650)', async () => {
  // The only branch the package deletes held nothing past a commit the remote already had, so
  // continuing that agent on a fresh branch from HEAD puts it exactly where it was.
  const git = nodeGitRunner()
  const repo = await realpath(await mkdtemp(join(tmpdir(), 'worktree-')))
  try {
    await git(['init'], repo)
    await git(['config', 'user.email', 't@t'], repo)
    await git(['config', 'user.name', 't'], repo)
    await writeFile(join(repo, 'README.md'), '# t\n')
    await git(['add', '-A'], repo)
    await git(['commit', '-m', 'init'], repo)

    const { path } = await attachWorktree(repo, { agentId: 'run1', branch: 'agent-run1' }, git)
    assert.equal(await currentBranch(path, git), 'agent-run1', 'the missing branch was created and checked out')
    await removeWorktree(repo, path, git)
    await deleteBranch(repo, 'agent-run1', git)
    await assert.rejects(() => git(['show-ref', '--verify', 'refs/heads/agent-run1'], repo), 'deleteBranch removed it')

    // A branch that exists but is checked out by the main checkout is git's refusal, not ours.
    const head = (await git(['rev-parse', '--abbrev-ref', 'HEAD'], repo)).trim()
    await assert.rejects(() => attachWorktree(repo, { agentId: 'run2', branch: head }, git))
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})

test('isWorktreeRoot is true for the main checkout and a linked worktree, false inside them and for a plain directory (#1654)', async () => {
  const git = nodeGitRunner()
  const repo = await realpath(await mkdtemp(join(tmpdir(), 'worktree-')))
  try {
    await git(['init'], repo)
    await git(['config', 'user.email', 't@t'], repo)
    await git(['config', 'user.name', 't'], repo)
    await writeFile(join(repo, 'README.md'), '# t\n')
    await git(['add', '-A'], repo)
    await git(['commit', '-m', 'init'], repo)
    const { path } = await addWorktree(repo, { agentId: 'run1', branch: 'agent-run1' }, git)
    // The hazard: a `.branches/` directory that is not a worktree. Git still answers in it — with
    // the enclosing repo's toplevel and branch.
    const residue = worktreePath(repo, 'run2')
    await mkdir(join(residue, 'leftover'), { recursive: true })

    assert.equal(await isWorktreeRoot(repo, git), true)
    assert.equal(await isWorktreeRoot(path, git), true)
    assert.equal(await isWorktreeRoot(join(repo, BRANCHES_DIR), git), false, 'a subdirectory of a checkout is not its root')
    assert.equal(await isWorktreeRoot(residue, git), false, 'and neither is a residue directory')
    assert.equal(await isWorktreeRoot(join(tmpdir()), git), false, 'nor a directory outside any repo')

    assert.equal(await currentBranch(residue, git), (await currentBranch(repo, git)), 'a plain read in the residue answers with the enclosing repo\'s branch — the bug')
    assert.equal(await worktreeBranch(residue, git), undefined, 'the guarded read answers with nothing')
    assert.equal(await worktreeBranch(path, git), 'agent-run1')
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})

test('removeWorktree tries a plain removal before forcing (#786)', async () => {
  const git = recordingGit()
  await removeWorktree(REPO, '/wt', git)
  assert.deepEqual(git.calls.map(c => c.args), [['worktree', 'remove', '/wt']]) // no --force needed
})

test('removeWorktree falls back to --force when git calls the checkout unclean (#786)', async () => {
  const calls: string[][] = []
  const git: GitRunner = async args => {
    calls.push(args)
    if (!args.includes('--force')) throw new Error('contains modified or untracked files')
    return ''
  }
  await removeWorktree(REPO, '/wt', git)
  assert.deepEqual(calls, [
    ['worktree', 'remove', '/wt'],
    ['worktree', 'remove', '--force', '/wt'],
  ])
})

// #786's point — a finished agent's edit must survive teardown — now holds by keeping, not by
// committing (#1638): the package commits nothing for an agent. A dirty checkout reads dirty and
// is the caller's to keep; once the agent has committed, the branch outlives the checkout.
test('a run worktree reads dirty until the agent commits; the branch then outlives it (#786/#1638)', async () => {
  const git = nodeGitRunner()
  const repo = await realpath(await mkdtemp(join(tmpdir(), 'worktree-')))
  try {
    await git(['init'], repo)
    await git(['config', 'user.email', 't@t'], repo)
    await git(['config', 'user.name', 't'], repo)
    await writeFile(join(repo, 'index.html'), '<h1>Hello, world!</h1>\n')
    await git(['add', '-A'], repo)
    await git(['commit', '-m', 'init'], repo)

    const { path, branch } = await addWorktree(repo, { agentId: 'run1', branch: 'agent-run1' }, git)
    // The agent edits and stops without committing, exactly as the system prompt leaves it.
    await writeFile(join(path, 'index.html'), '<h1>Welcome!</h1>\n')

    assert.equal(await worktreeClean(path, git), false, 'the uncommitted edit is reported, never swept into a commit')
    await git(['add', '-A'], path)
    await git(['commit', '-m', 'welcome'], path)
    assert.equal(await worktreeClean(path, git), true)
    await removeWorktree(repo, path, git)
    await assert.rejects(() => stat(path), 'checkout dir is gone')

    // The branch outlived the worktree and carries the edit.
    const shown = await git(['show', `${branch}:index.html`], repo)
    assert.match(shown, /Welcome!/, 'the edit survives on the run branch')
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})

test('agentBranchName names the branch after the run id (#736)', () => {
  assert.equal(agentBranchName('2026-07-19T10-00-00-000Z'), 'agent-2026-07-19T10-00-00-000Z')
})

test('currentBranch reads the checked-out branch, and reads detached/non-repo as undefined', async () => {
  assert.equal(await currentBranch(REPO, recordingGit('agent-1\n')), 'agent-1')
  assert.equal(await currentBranch(REPO, recordingGit('HEAD\n')), undefined, 'detached HEAD is not a branch')
  assert.equal(await currentBranch(REPO, failingGit), undefined)
})

/** A directory reader over one listing: `entries[dir]` are the directory names under `dir`. */
const listing = (entries: Record<string, string[]>) => async (dir: string) => entries[dir] ?? []

test('listWorktreeDirs lists the agent-branch-named dirs under .branches/ and nothing else (#737/#1580)', async () => {
  const root = join('/repo', BRANCHES_DIR)
  const readdir = listing({ [root]: ['agent-r1', 'agent-r2', '.tmp'] })
  assert.deepEqual((await listWorktreeDirs('/repo', readdir)).sort(), ['r1', 'r2'])
  assert.deepEqual(await listWorktreeDirs('/never-ran', readdir), [])
})

test('listWorktreeDirs never mistakes a rename link for a checkout: a link is not a directory (#1580)', async () => {
  // A rename link beside the checkouts is named as an agent branch too; only the real directory
  // is a checkout, so the default reader must tell them apart by type, not by name.
  const repo = await realpath(await mkdtemp(join(tmpdir(), 'worktree-')))
  try {
    await mkdir(join(repo, BRANCHES_DIR, 'agent-r1'), { recursive: true })
    await symlink('agent-r1', join(repo, BRANCHES_DIR, 'agent-cool-name'))
    await writeFile(join(repo, BRANCHES_DIR, 'agent-note'), 'not a checkout either\n')
    assert.deepEqual(await listWorktreeDirs(repo), ['r1'])
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})

test('nameBranch: a rename lost to a sibling naming the same thing at the same moment takes the next suffix (review)', async () => {
  // The branches read says `agent-x` is free; the rename then loses the race; the re-read shows it taken.
  let renames = 0
  const racing: GitRunner = async (args, cwd) => {
    if (args[0] === 'rev-parse' && args[1] === '--show-toplevel') return cwd + '\n'
    if (args[0] === 'rev-parse') return 'agent-1\n'
    if (args[0] === 'for-each-ref') return renames === 0 ? 'refs/heads/agent-1\n' : 'refs/heads/agent-1\nrefs/heads/agent-x\n'
    if (args[0] === 'branch' && args[1] === '-m') {
      if (renames++ === 0) throw new Error("fatal: a branch named 'agent-x' already exists")
      return ''
    }
    throw new Error(`unexpected git ${args.join(' ')}`)
  }
  const wt = await realpath(tmpdir())
  assert.deepEqual(await nameBranch(wt, 'x', racing), { ok: true, branch: 'agent-x-2' })
  assert.equal(renames, 2)

  // Any other rename failure is the caller's to see.
  const broken: GitRunner = async (args, cwd) => {
    if (args[0] === 'rev-parse' && args[1] === '--show-toplevel') return cwd + '\n'
    if (args[0] === 'rev-parse') return 'agent-1\n'
    if (args[0] === 'for-each-ref') return ''
    throw new Error('fatal: disk full')
  }
  await assert.rejects(() => nameBranch(wt, 'x', broken), /disk full/)
})
