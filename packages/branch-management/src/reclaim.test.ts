import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises'
import { addWorktree, agentBranchName, nodeGitRunner, reclaimWorktree, type ReclaimOptions } from './index.js'

// #982/E5: one rule decides every removal — the checkout goes only once the remote has it. So
// nothing local is ever the last copy of anything, and the one failure mode is legible: the push
// did not land. Against real git, because "was the diff actually destroyed" is not a question a
// fake answers.

const RUN_ID = 'run1'
const ORDINARY: ReclaimOptions = { birthBranch: agentBranchName(RUN_ID), mayPush: true }

/**
 * A repo whose checkout holds an uncommitted edit, as a failed agent leaves one, with a bare repo
 * standing in for `origin` — real, since whether the work reached it is the whole subject.
 */
async function repoWithDirtyWorktree(opts: { remote?: boolean } = {}): Promise<{ repo: string; path: string; branch: string }> {
  const git = nodeGitRunner()
  // realpath so the mkdtemp path matches what git reports (the /var -> /private/var symlink).
  const repo = await realpath(await mkdtemp(join(tmpdir(), 'branch-management-reclaim-')))
  await git(['init'], repo)
  await git(['config', 'user.email', 't@t'], repo)
  await git(['config', 'user.name', 't'], repo)
  await writeFile(join(repo, 'index.html'), '<h1>Hello, world!</h1>\n')
  await git(['add', '-A'], repo)
  await git(['commit', '-m', 'init'], repo)
  if (opts.remote !== false) {
    await git(['init', '-q', '--bare', join(repo, 'origin.git')], repo)
    await git(['remote', 'add', 'origin', join(repo, 'origin.git')], repo)
  }
  const { path, branch } = await addWorktree(repo, { agentId: RUN_ID, branch: agentBranchName(RUN_ID) }, git)
  await writeFile(join(path, 'index.html'), '<h1>Welcome!</h1>\n')
  return { repo, path, branch }
}

/** The agent commits its own work (#1638). */
async function commitWork(path: string, message = 'work'): Promise<void> {
  const git = nodeGitRunner()
  await git(['config', 'user.email', 't@t'], path)
  await git(['config', 'user.name', 't'], path)
  await git(['add', '-A'], path)
  await git(['commit', '-q', '-m', message], path)
}

/** Hides the checkout's own bookkeeping directory from `git status`, as the install's ignore file does. */
async function ignoreFrameworkDir(repo: string, path: string): Promise<void> {
  await mkdir(join(repo, '.git', 'info'), { recursive: true })
  await writeFile(join(repo, '.git', 'info', 'exclude'), '.the-framework/\n')
  await mkdir(join(path, '.the-framework'), { recursive: true })
  await writeFile(join(path, '.the-framework', 'agent.json'), '{}')
}

test('a checkout holding uncommitted work is kept — nothing is committed for the agent (#1638)', async () => {
  const { repo, path, branch } = await repoWithDirtyWorktree()
  const git = nodeGitRunner()
  try {
    assert.deepEqual(await reclaimWorktree(repo, path, ORDINARY), { ok: false, reason: 'dirty', branch })
    assert.equal((await stat(path)).isDirectory(), true, 'the checkout is still on disk')
    assert.match(await readFile(join(path, 'index.html'), 'utf8'), /Welcome!/, 'with the work still in it, uncommitted')
    assert.equal((await git(['log', '--format=%s', branch], repo)).trim(), 'init', 'no commit was grabbed')
    await assert.rejects(() => git(['rev-parse', '--verify', `refs/remotes/origin/${branch}`], repo), 'and nothing reached the remote')
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})

test('a reclaimed checkout keeps the work its agent committed, on the branch and the remote (#982/E5)', async () => {
  const { repo, path, branch } = await repoWithDirtyWorktree()
  const git = nodeGitRunner()
  try {
    await commitWork(path)
    assert.deepEqual(await reclaimWorktree(repo, path, ORDINARY), { ok: true })
    await assert.rejects(() => stat(path), 'the checkout is gone')
    assert.match(await git(['show', `${branch}:index.html`], repo), /Welcome!/, 'the committed edit survived on the branch')
    assert.match(await git(['show', `refs/remotes/origin/${branch}:index.html`], repo), /Welcome!/, 'and on the remote, which is what made the deletion recoverable')
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})

test('a checkout whose branch cannot reach the remote is kept, with what git said (E5)', async () => {
  // No remote configured: nothing is recoverable, so nothing is deleted.
  const { repo, path, branch } = await repoWithDirtyWorktree({ remote: false })
  try {
    await commitWork(path)
    const result = await reclaimWorktree(repo, path, ORDINARY)
    assert.equal(result.ok, false)
    assert.equal(result.ok === false ? result.reason : '', 'not-on-remote')
    const refusal = result.ok === false && result.reason === 'not-on-remote' ? result : undefined
    assert.equal(refusal?.branch, branch)
    assert.match(refusal?.detail ?? '', /origin/)
    assert.equal((await stat(path)).isDirectory(), true, 'the checkout is still on disk')
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})

test('a checkout that may not be pushed goes only from a clean tree on a tip the remote already has (B5)', async () => {
  const { repo, path, branch } = await repoWithDirtyWorktree()
  const git = nodeGitRunner()
  try {
    const noPush: ReclaimOptions = { ...ORDINARY, mayPush: false }
    assert.deepEqual(await reclaimWorktree(repo, path, noPush), { ok: false, reason: 'dirty', branch })
    await commitWork(path)
    assert.deepEqual(await reclaimWorktree(repo, path, noPush), { ok: false, reason: 'not-on-remote', branch })
    await assert.rejects(() => git(['rev-parse', '--verify', `refs/remotes/origin/${branch}`], repo), 'nothing reached the remote')
    await git(['push', '-q', 'origin', branch], path)
    assert.deepEqual(await reclaimWorktree(repo, path, noPush), { ok: true })
    await assert.rejects(() => stat(path), 'once someone pushed it, the checkout goes')
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})

test('a clean checkout whose tip is inside a pushed anchor goes without a push, and keeps its branch (#1601)', async () => {
  const { repo, path, branch } = await repoWithDirtyWorktree()
  const git = nodeGitRunner()
  try {
    await git(['checkout', '--', '.'], path)
    await ignoreFrameworkDir(repo, path)
    const anchor = (await git(['rev-parse', 'HEAD'], repo)).trim()
    await git(['push', '-q', 'origin', 'HEAD:main'], repo)
    assert.deepEqual(await reclaimWorktree(repo, path, { ...ORDINARY, heldBy: anchor }), { ok: true })
    await assert.rejects(() => stat(path), 'the checkout is gone')
    await assert.rejects(() => git(['rev-parse', '--verify', `refs/remotes/origin/${branch}`], repo), 'nothing was pushed under the branch name')
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})

test('a run branch holding nothing the remote lacks goes with its checkout, unpushed (#1650)', async () => {
  // A triage that wrote only to the data branch, or a run stopped before its first commit: the
  // branch tip is the commit it started from, which origin already has.
  const { repo, path, branch } = await repoWithDirtyWorktree()
  const git = nodeGitRunner()
  try {
    await git(['push', '-q', 'origin', 'HEAD:main'], repo)
    await git(['checkout', '--', '.'], path)
    await ignoreFrameworkDir(repo, path)
    assert.deepEqual(await reclaimWorktree(repo, path, ORDINARY), { ok: true, branchesDeleted: [branch] })
    await assert.rejects(() => stat(path), 'the checkout is gone')
    await assert.rejects(() => git(['rev-parse', '--verify', `refs/remotes/origin/${branch}`], repo), 'nothing reached origin')
    await assert.rejects(() => git(['rev-parse', '--verify', `refs/heads/${branch}`], repo), 'and the branch went with the checkout')
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})

test('a clean checkout whose commit the remote does not have yet is pushed and keeps its branch (#1650)', async () => {
  // The carve-out is for a branch that provably holds nothing. A commit origin has never seen is
  // exactly what the ordinary rule exists to protect, clean tree or not.
  const { repo, path, branch } = await repoWithDirtyWorktree()
  const git = nodeGitRunner()
  try {
    await git(['push', '-q', 'origin', 'HEAD:main'], repo)
    await commitWork(path)
    assert.deepEqual(await reclaimWorktree(repo, path, ORDINARY), { ok: true })
    await assert.rejects(() => stat(path), 'the checkout is gone')
    assert.match(await git(['show', `refs/remotes/origin/${branch}:index.html`], repo), /Welcome!/, 'the commit reached origin')
    assert.match(await git(['show', `${branch}:index.html`], repo), /Welcome!/, 'and the branch stays')
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})

test('a run branch pushed under its own name holds its own work, so it stays (#1650)', async () => {
  // `origin/<branch>` contains the branch tip by definition. Counting it would read every pushed
  // run branch — the one with the PR — as holding nothing, and delete the local copy after each run.
  const { repo, path, branch } = await repoWithDirtyWorktree()
  const git = nodeGitRunner()
  try {
    await commitWork(path)
    await git(['push', '-q', 'origin', branch], path)
    assert.deepEqual(await reclaimWorktree(repo, path, ORDINARY), { ok: true })
    await assert.rejects(() => stat(path), 'the checkout is gone')
    assert.match(await git(['show', `${branch}:index.html`], repo), /Welcome!/, 'the branch stays')
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})

test('a leftover checkout on a branch not minted for an agent keeps that branch, empty or not (#1650)', async () => {
  // Found on a rig: a reclaimed checkout sitting on `main`. It held nothing, and `git branch -D
  // main` failed only because the primary checkout had it out — git's refusal is not the guard.
  const { repo, path } = await repoWithDirtyWorktree()
  const git = nodeGitRunner()
  try {
    await git(['push', '-q', 'origin', 'HEAD:main'], repo)
    await git(['checkout', '--', '.'], path)
    await git(['checkout', '-q', '-b', 'release'], path)
    await ignoreFrameworkDir(repo, path)
    // The user's branch stays; the birth branch it was cut from is ours and holds nothing
    // `release` does not, so that one goes (#1657).
    assert.deepEqual(await reclaimWorktree(repo, path, ORDINARY), { ok: true, branchesDeleted: [agentBranchName(RUN_ID)] })
    await assert.rejects(() => stat(path), 'the checkout is gone')
    await git(['rev-parse', '--verify', 'refs/heads/release'], repo)
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})

test('a directory that is not a git worktree is refused before any git runs in it (#1654)', async () => {
  // A checkout removed by hand, then a marker written into the path. Git, asked in that
  // directory, answers for the enclosing repo — so the ordinary rule would push the user's main
  // and judge it for deletion.
  const { repo, path: worktree } = await repoWithDirtyWorktree()
  const git = nodeGitRunner()
  try {
    await git(['worktree', 'remove', '--force', worktree], repo)
    await mkdir(join(worktree, '.the-framework'), { recursive: true })
    await writeFile(join(worktree, '.the-framework', 'agent.json'), '{}')
    await writeFile(join(repo, 'index.html'), '<h1>half-typed</h1>\n')
    assert.deepEqual(await reclaimWorktree(repo, worktree, ORDINARY), { ok: false, reason: 'not-a-worktree' })
    assert.match(await git(['status', '--porcelain'], repo), /index\.html/, "the user's edit is still uncommitted")
    assert.equal((await git(['ls-remote', '--heads', 'origin'], repo)).trim(), '', 'and nothing was pushed')
    assert.equal((await stat(worktree)).isDirectory(), true, 'the directory is left where it is')
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})

test('the birth branch the agent branched away from goes with the checkout when the kept branch contains it (#1657)', async () => {
  const { repo, path, branch: birth } = await repoWithDirtyWorktree()
  const git = nodeGitRunner()
  try {
    await git(['push', '-q', 'origin', 'HEAD:main'], repo)
    await git(['checkout', '-q', '-b', 'tf-cool-name'], path)
    await commitWork(path)
    assert.deepEqual(await reclaimWorktree(repo, path, ORDINARY), { ok: true, branchesDeleted: [birth] })
    assert.match(await git(['show', 'tf-cool-name:index.html'], repo), /Welcome!/, 'the work branch stays, pushed')
    assert.match(await git(['show', 'refs/remotes/origin/tf-cool-name:index.html'], repo), /Welcome!/)
    await assert.rejects(() => git(['rev-parse', '--verify', `refs/heads/${birth}`], repo), 'the birth branch is gone')
    await assert.rejects(() => git(['rev-parse', '--verify', `refs/remotes/origin/${birth}`], repo), 'and was never pushed')
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})

test('a commitless run leaves neither the branch it ended on nor its birth branch (#1650, #1657)', async () => {
  const { repo, path, branch: birth } = await repoWithDirtyWorktree()
  const git = nodeGitRunner()
  try {
    await git(['push', '-q', 'origin', 'HEAD:main'], repo)
    await git(['checkout', '--', '.'], path)
    await git(['checkout', '-q', '-b', 'tf-triage-quick'], path)
    await ignoreFrameworkDir(repo, path)
    assert.deepEqual(await reclaimWorktree(repo, path, ORDINARY), { ok: true, branchesDeleted: ['tf-triage-quick', birth] })
    assert.equal((await git(['branch', '--list', 'tf-*'], repo)).trim(), '', 'no tf- branch is left')
    assert.equal((await git(['ls-remote', '--heads', 'origin', 'tf-*'], repo)).trim(), '', 'and none reached origin')
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})

test('a birth branch carrying a commit the kept branch lacks stays (#1657)', async () => {
  // The agent committed on the birth branch, then branched from the init commit and went on
  // from there. The birth branch holds something the kept branch does not, so it is not ours to delete.
  const { repo, path, branch: birth } = await repoWithDirtyWorktree()
  const git = nodeGitRunner()
  try {
    await git(['push', '-q', 'origin', 'HEAD:main'], repo)
    await commitWork(path, 'early work on the birth branch')
    const init = (await git(['rev-parse', 'HEAD'], repo)).trim()
    await git(['checkout', '-q', '-b', 'tf-other', init], path)
    await writeFile(join(path, 'other.txt'), 'later\n')
    await commitWork(path, 'later work elsewhere')
    assert.deepEqual(await reclaimWorktree(repo, path, ORDINARY), { ok: true })
    assert.match(await git(['show', `${birth}:index.html`], repo), /Welcome!/, 'the early commit is still on the birth branch')
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})

test('a branch renamed after its birth name was pushed is pushed under its new name, never read as empty (#1725 review)', async () => {
  const { repo, path } = await repoWithDirtyWorktree()
  const git = nodeGitRunner()
  try {
    await commitWork(path)
    await git(['push', '-q', '--set-upstream', 'origin', 'tf-agent-run1'], path)
    await git(['branch', '-m', 'tf-agent-run1', 'tf-renamed'], path)
    // The tip is on the remote under the old name only — the branch's own tracked copy, not
    // another name holding it. So it is not "empty": it is pushed under the name it has now.
    assert.deepEqual(await reclaimWorktree(repo, path, ORDINARY), { ok: true })
    assert.match(await git(['show', 'refs/remotes/origin/tf-renamed:index.html'], repo), /Welcome!/, 'pushed under the new name')
    assert.equal((await git(['rev-parse', '--verify', 'refs/heads/tf-renamed'], repo)).trim().length, 40, 'and the local branch stays')
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})
