import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises'
import { deleteProjectAgent, removeProjectWorktree } from './worktrees.js'
import { listAgents } from './store/index.js'
import { nodeGitRunner } from '@gemstack/agent-data'
import { runFiles, writeRun } from '@gemstack/skill-logs'
import { addWorktree, agentBranchName } from '@gemstack/skill-branches'
// The dashboard's side of reclaiming a checkout: when it may be asked for, and how a refusal is said. The rule itself is tested where it lives, in the `skill-branches` package.
// Against real git, because "was the diff actually destroyed" is not a question a fake answers.

const RUN_ID = 'run1'

/**
 * A repo whose retained worktree holds an uncommitted edit, as a failed agent leaves one, with a bare
 * repo standing in for `origin` — real, since whether the work reached it is the whole subject.
 */
async function repoWithDirtyWorktree(opts: { remote?: boolean } = {}): Promise<{ repo: string; path: string; branch: string }> {
  const git = nodeGitRunner()
  // realpath so the mkdtemp path matches what git reports (the /var -> /private/var symlink).
  const repo = await realpath(await mkdtemp(join(tmpdir(), 'framework-worktrees-')))
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

/** The agent commits its own work, as the system prompt tells it to (#1638). */
async function commitWork(path: string): Promise<void> {
  const git = nodeGitRunner()
  await git(['config', 'user.email', 't@t'], path)
  await git(['config', 'user.name', 't'], path)
  await git(['add', '-A'], path)
  await git(['commit', '-q', '-m', 'work'], path)
}

test('a worktree whose branch cannot reach the remote is kept, and says so (E5)', async () => {
  // No remote configured: nothing is recoverable, so nothing is deleted.
  const { repo, path } = await repoWithDirtyWorktree({ remote: false })
  try {
    await commitWork(path)
    const result = await removeProjectWorktree(repo, RUN_ID)
    assert.equal(result.ok, false)
    assert.match(result.ok === false ? result.error : '', /not on the remote/)
    assert.equal((await stat(path)).isDirectory(), true, 'the checkout is still on disk')
    assert.match(await readFile(join(path, 'index.html'), 'utf8'), /Welcome!/, 'with the work still in it')
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})

test("a branches/ directory that is not a git worktree is refused before any git runs in it (#1654)", async () => {
  // Found on the rig: a checkout removed by hand, then a failed-start marker written into the
  // path. Git, asked in that directory, answers for the enclosing repo — so the ordinary rule
  // would commit the user's main checkout, push the user's main, and judge it for deletion.
  const { repo, path: worktree } = await repoWithDirtyWorktree()
  const git = nodeGitRunner()
  try {
    // Turn the run's checkout into residue: gone as a worktree, its directory holding only the
    // framework's bookkeeping. And leave the user's own checkout dirty, which is what must survive.
    await git(['worktree', 'remove', '--force', worktree], repo)
    await mkdir(join(worktree, '.the-framework'), { recursive: true })
    await writeFile(join(worktree, '.the-framework', `${RUN_ID}.json`), JSON.stringify({ id: RUN_ID, startedAt: '2026-01-01T00:00:00.000Z', status: 'failed' }))
    await writeFile(join(repo, 'index.html'), '<h1>half-typed</h1>\n')
    const before = (await git(['rev-parse', 'HEAD'], repo)).trim()

    const result = await removeProjectWorktree(repo, RUN_ID)
    assert.equal(result.ok, false)
    assert.match(result.ok === false ? result.error : '', /not a git worktree; left alone/)
    assert.equal((await git(['rev-parse', 'HEAD'], repo)).trim(), before, "nothing was committed on the user's checkout")
    assert.match(await git(['status', '--porcelain'], repo), /index\.html/, "the user's edit is still uncommitted")
    assert.equal((await git(['ls-remote', '--heads', 'origin'], repo)).trim(), '', 'and nothing was pushed')
    assert.equal((await stat(worktree)).isDirectory(), true, 'the directory is left where it is')
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})

test('the run-id branch the agent branched away from goes with the checkout when the kept branch contains it (#1657)', async () => {
  // The framework names the checkout's birth branch to the rule; without it nothing would go.
  const { repo, path, branch: runBranch } = await repoWithDirtyWorktree()
  const git = nodeGitRunner()
  try {
    await git(['push', '-q', 'origin', 'HEAD:main'], repo)
    await git(['checkout', '-q', '-b', 'agent-cool-name'], path)
    await commitWork(path)
    assert.deepEqual(await removeProjectWorktree(repo, RUN_ID), { ok: true, branchesDeleted: [runBranch] })
    assert.match(await git(['show', 'refs/remotes/origin/agent-cool-name:index.html'], repo), /Welcome!/, 'the work branch stays, pushed')
    await assert.rejects(() => git(['rev-parse', '--verify', `refs/heads/${runBranch}`], repo), 'the run-id branch is gone')
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})

test('an unknown session is refused before any git runs (#982)', async () => {
  const { repo, path } = await repoWithDirtyWorktree()
  try {
    assert.deepEqual(await removeProjectWorktree(repo, 'nosuchrun'), {
      ok: false,
      error: 'no worktree for session nosuchrun',
    })
    assert.equal((await stat(path)).isDirectory(), true, 'the real worktree is untouched')
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})

// #1032: delete removes the session from the dashboard, records and all — where remove-worktree
// keeps it. Against real git, because "did the branch survive" is the whole distinction.

/** Record a run on the data branch, the way a run's tool does: the two files that put its row in the rail. */
async function recordRun(repo: string, id: string): Promise<{ card: string; diary: string }> {
  const written = await writeRun(repo, { id, startedAt: '2026-01-01T00:00:00.000Z', status: 'stopped' }, [{ kind: 'ended', status: 'stopped' }])
  assert.ok(written.ok || written.committed, 'the record landed')
  return (await runFiles(repo, id))!
}

test('deleting a record-only session (its worktree already gone) still clears the row (#1032)', async () => {
  const { repo } = await repoWithDirtyWorktree()
  try {
    const { card: meta } = await recordRun(repo, 'run-x')
    // No worktree on disk — a clean finished agent, or one already removed. Delete must not need one.
    assert.deepEqual(await deleteProjectAgent(repo, 'run-x'), { ok: true })
    await assert.rejects(() => stat(meta), 'the record is gone')
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})

test('an invalid session id is refused before anything is touched (#1032)', async () => {
  const result = await deleteProjectAgent('/nowhere', '../etc/passwd')
  assert.equal(result.ok, false)
  assert.match(result.ok === false ? result.error : '', /invalid session id/)
})
