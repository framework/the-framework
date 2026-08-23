import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises'
import { deleteProjectAgent, removeProjectWorktree } from './worktrees.js'
import { addWorktree, listAgents, agentBranchName } from './store/index.js'
import { nodeGitRunner } from './project.js'

// #982/E5: one rule decides every removal — the work is committed to the session's branch, the
// branch is pushed, and the checkout goes only once the remote has it. So nothing local is ever
// the last copy of anything, and the one failure mode is legible: the push did not land.
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

test('removing a retained worktree keeps the work it was holding, on the branch and the remote (#982/E5)', async () => {
  const { repo, path, branch } = await repoWithDirtyWorktree()
  const git = nodeGitRunner()
  try {
    assert.deepEqual(await removeProjectWorktree(repo, RUN_ID), { ok: true })
    await assert.rejects(() => stat(path), 'the checkout is gone')
    assert.match(
      await git(['show', `${branch}:index.html`], repo),
      /Welcome!/,
      'the uncommitted edit survived on the branch instead of being forced away',
    )
    assert.match(
      await git(['show', `refs/remotes/origin/${branch}:index.html`], repo),
      /Welcome!/,
      'and on the remote, which is what made the deletion recoverable',
    )
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})

test('a worktree whose branch cannot reach the remote is kept, and says so (E5)', async () => {
  // No remote configured: nothing is recoverable, so nothing is deleted.
  const { repo, path } = await repoWithDirtyWorktree({ remote: false })
  try {
    const result = await removeProjectWorktree(repo, RUN_ID)
    assert.equal(result.ok, false)
    assert.match(result.ok === false ? result.error : '', /not on the remote/)
    assert.equal((await stat(path)).isDirectory(), true, 'the checkout is still on disk')
    assert.match(await readFile(join(path, 'index.html'), 'utf8'), /Welcome!/, 'with the work still in it')
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})

test('a publish-nothing session keeps its checkout instead of being pushed to make it removable (B5)', async () => {
  // A remote exists and the push would succeed — that is the point: `handoff: local` said the
  // branch must not reach it, and removal's own push is still a publish.
  const { repo, path, branch } = await repoWithDirtyWorktree()
  const git = nodeGitRunner()
  try {
    const now = new Date().toISOString()
    await mkdir(join(path, '.the-framework'), { recursive: true })
    await writeFile(
      join(path, '.the-framework', 'agent.json'),
      JSON.stringify({ status: 'done', id: RUN_ID, startedAt: now, updatedAt: now, handoff: { push: false, pr: false } }),
    )
    const result = await removeProjectWorktree(repo, RUN_ID)
    assert.equal(result.ok, false)
    assert.match(result.ok === false ? result.error : '', /publish nothing/)
    assert.equal((await stat(path)).isDirectory(), true, 'the checkout is still on disk')
    await assert.rejects(
      () => git(['rev-parse', '--verify', `refs/remotes/origin/${branch}`], repo),
      'and nothing reached the remote',
    )
    // Nothing committed on the way to the refusal either: a kept checkout is a place someone
    // works, and the sweep re-offers it every pass — half-typed edits must stay theirs.
    assert.ok((await git(['status', '--porcelain'], path)).trim().length > 0, 'the uncommitted edit is untouched')
    assert.equal((await git(['log', '--format=%s', branch], repo)).trim(), 'init', 'no commit was grabbed')
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})

test('a record that cannot be read keeps the checkout: unreadable is not "publish freely" (B5)', async () => {
  // A meta exists but does not parse. Absent would mean a boot death and take the recoverable
  // default (push); unreadable cannot tell a publish-nothing session from any other, so the
  // removal refuses rather than guesses.
  const { repo, path, branch } = await repoWithDirtyWorktree()
  const git = nodeGitRunner()
  try {
    await mkdir(join(path, '.the-framework'), { recursive: true })
    await writeFile(join(path, '.the-framework', 'agent.json'), 'not json')
    const result = await removeProjectWorktree(repo, RUN_ID)
    assert.equal(result.ok, false)
    assert.match(result.ok === false ? result.error : '', /could not be read/)
    assert.equal((await stat(path)).isDirectory(), true, 'the checkout is still on disk')
    await assert.rejects(
      () => git(['rev-parse', '--verify', `refs/remotes/origin/${branch}`], repo),
      'and nothing reached the remote',
    )
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})

test('a publish-nothing session whose branch is already on the remote still lets the checkout go (B5)', async () => {
  // Someone else pushed it (the user, by hand). Removing what the remote already holds publishes
  // nothing, so the handoff rung has nothing to refuse.
  const { repo, path, branch } = await repoWithDirtyWorktree()
  const git = nodeGitRunner()
  try {
    const now = new Date().toISOString()
    await mkdir(join(path, '.the-framework'), { recursive: true })
    await writeFile(
      join(path, '.the-framework', 'agent.json'),
      JSON.stringify({ status: 'done', id: RUN_ID, startedAt: now, updatedAt: now, handoff: { push: false, pr: false } }),
    )
    await git(['config', 'user.email', 't@t'], path)
    await git(['config', 'user.name', 't'], path)
    await git(['add', '-A'], path)
    await git(['commit', '-m', 'work'], path)
    await git(['push', 'origin', branch], path)
    assert.deepEqual(await removeProjectWorktree(repo, RUN_ID), { ok: true })
    await assert.rejects(() => stat(path), 'the checkout is gone')
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})

test("a web run's checkout goes without pushing its empty run branch to origin (#1601)", async () => {
  // The hand-off pushed everything the cloud session clones at, and the work lands on the
  // session's own remote branch — pushing the local run branch just to satisfy the remote rule
  // is what accreted one dead `tf-agent-*` ref on origin per web run.
  const { repo, path, branch } = await repoWithDirtyWorktree()
  const git = nodeGitRunner()
  try {
    // A web run's wrapper never edits, so its tree is clean — and the framework's own
    // bookkeeping is git-excluded, as the install leaves every activated repo (#1600).
    await git(['checkout', '--', '.'], path)
    await mkdir(join(repo, '.git', 'info'), { recursive: true })
    await writeFile(join(repo, '.git', 'info', 'exclude'), '.the-framework/\n')
    const anchor = (await git(['commit-tree', 'HEAD^{tree}', '-p', 'HEAD', '-m', 'hand-off'], path)).trim()
    const now = new Date().toISOString()
    await mkdir(join(path, '.the-framework'), { recursive: true })
    await writeFile(
      join(path, '.the-framework', 'agent.json'),
      JSON.stringify({ status: 'done', id: RUN_ID, startedAt: now, updatedAt: now, target: 'web', cloudAnchor: anchor }),
    )
    assert.deepEqual(await removeProjectWorktree(repo, RUN_ID), { ok: true })
    await assert.rejects(() => stat(path), 'the checkout is gone')
    await assert.rejects(
      () => git(['rev-parse', '--verify', `refs/remotes/origin/${branch}`], repo),
      'and no empty run branch reached origin',
    )
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})

test('a web run whose checkout holds more than the hand-off carried falls back to the ordinary rule (#1601)', async () => {
  // The dirty tree is exactly the doubt the carve-out must not swallow: the ordinary rule
  // commits and pushes, which is never worse than what every web run got before.
  const { repo, path, branch } = await repoWithDirtyWorktree()
  const git = nodeGitRunner()
  try {
    const anchor = (await git(['commit-tree', 'HEAD^{tree}', '-p', 'HEAD', '-m', 'hand-off'], path)).trim()
    const now = new Date().toISOString()
    await mkdir(join(path, '.the-framework'), { recursive: true })
    await writeFile(
      join(path, '.the-framework', 'agent.json'),
      JSON.stringify({ status: 'done', id: RUN_ID, startedAt: now, updatedAt: now, target: 'web', cloudAnchor: anchor }),
    )
    assert.deepEqual(await removeProjectWorktree(repo, RUN_ID), { ok: true })
    assert.match(
      await git(['show', `refs/remotes/origin/${branch}:index.html`], repo),
      /Welcome!/,
      'the edit survived on the remote, exactly as a non-web run would have it',
    )
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})

test('a run branch holding nothing the remote lacks goes with its checkout, unpushed (#1650)', async () => {
  // A triage that wrote only to the data branch, or a run stopped before its first commit: the
  // branch tip is the commit it started from, which origin already has. Pushing it is what put an
  // empty `tf-triage-quick` on origin; keeping it is what made the next triage stand down behind
  // a branch that "already exists" — on any repo where no PR ever carried the name, so the
  // stale-branch release could not prove it dead.
  const { repo, path, branch } = await repoWithDirtyWorktree()
  const git = nodeGitRunner()
  try {
    await git(['push', '-q', 'origin', 'HEAD:main'], repo)
    await git(['checkout', '--', '.'], path)
    await mkdir(join(repo, '.git', 'info'), { recursive: true })
    await writeFile(join(repo, '.git', 'info', 'exclude'), '.the-framework/\n')
    const now = new Date().toISOString()
    await mkdir(join(path, '.the-framework'), { recursive: true })
    await writeFile(join(path, '.the-framework', 'agent.json'), JSON.stringify({ status: 'done', id: RUN_ID, startedAt: now, updatedAt: now }))
    assert.deepEqual(await removeProjectWorktree(repo, RUN_ID), { ok: true, branchDeleted: branch })
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
    await git(['config', 'user.email', 't@t'], path)
    await git(['config', 'user.name', 't'], path)
    await git(['add', '-A'], path)
    await git(['commit', '-q', '-m', 'work'], path)
    assert.deepEqual(await removeProjectWorktree(repo, RUN_ID), { ok: true })
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
    await git(['config', 'user.email', 't@t'], path)
    await git(['config', 'user.name', 't'], path)
    await git(['add', '-A'], path)
    await git(['commit', '-q', '-m', 'work'], path)
    await git(['push', '-q', 'origin', branch], path)
    assert.deepEqual(await removeProjectWorktree(repo, RUN_ID), { ok: true })
    await assert.rejects(() => stat(path), 'the checkout is gone')
    assert.match(await git(['show', `${branch}:index.html`], repo), /Welcome!/, 'the branch stays')
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})

test("a leftover checkout on a branch the framework did not mint keeps that branch, empty or not (#1650)", async () => {
  // Found on the rig: a reclaimed checkout sitting on `main`. It held nothing, and `git branch -D
  // main` failed only because the primary checkout had it out — git's refusal is not the guard.
  const { repo, path } = await repoWithDirtyWorktree()
  const git = nodeGitRunner()
  try {
    await git(['push', '-q', 'origin', 'HEAD:main'], repo)
    await git(['checkout', '--', '.'], path)
    await git(['checkout', '-q', '-b', 'release'], path)
    await mkdir(join(repo, '.git', 'info'), { recursive: true })
    await writeFile(join(repo, '.git', 'info', 'exclude'), '.the-framework/\n')
    assert.deepEqual(await removeProjectWorktree(repo, RUN_ID), { ok: true })
    await assert.rejects(() => stat(path), 'the checkout is gone')
    await git(['rev-parse', '--verify', 'refs/heads/release'], repo)
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
    await writeFile(join(worktree, '.the-framework', 'agent.json'), JSON.stringify({ status: 'failed', id: RUN_ID }))
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

test('a worktree whose work cannot be committed is refused, not force-removed (#982)', async () => {
  const { repo, path } = await repoWithDirtyWorktree()
  try {
    // A refusing pre-commit hook is the reproducible version of "no git identity": the commit
    // fails, so the work only exists in the working tree and the checkout must survive.
    const hooks = join(repo, 'hooks')
    await mkdir(hooks, { recursive: true })
    await writeFile(join(hooks, 'pre-commit'), '#!/bin/sh\nexit 1\n', { mode: 0o755 })
    await nodeGitRunner()(['config', 'core.hooksPath', hooks], repo)

    const result = await removeProjectWorktree(repo, RUN_ID)
    assert.equal(result.ok, false, 'removal is refused rather than forced')
    assert.match(result.ok === false ? result.error : '', /uncommitted work/)
    assert.equal((await stat(path)).isDirectory(), true, 'the checkout is still on disk')
    assert.match(await readFile(join(path, 'index.html'), 'utf8'), /Welcome!/, 'with the work still in it')
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

/** Write an archived agent's meta + log, the two files that put its row in the rail. */
async function archiveAgent(repo: string, id: string): Promise<{ meta: string; log: string }> {
  const agents = join(repo, '.the-framework', 'agents')
  await mkdir(agents, { recursive: true })
  const meta = join(agents, `${id}.json`)
  const log = join(agents, `${id}.jsonl`)
  await writeFile(meta, JSON.stringify({ version: 1, status: 'stopped', id, startedAt: '2026-01-01T00:00:00.000Z' }))
  await writeFile(log, '{"kind":"end"}\n')
  return { meta, log }
}

test('deleting a session removes its records and worktree but keeps the branch (#1032)', async () => {
  const { repo, path, branch } = await repoWithDirtyWorktree()
  try {
    const { meta, log } = await archiveAgent(repo, RUN_ID)
    assert.equal((await listAgents(repo)).some(r => r.id === RUN_ID), true, 'the row is listed to begin with')

    assert.deepEqual(await deleteProjectAgent(repo, RUN_ID), { ok: true })

    await assert.rejects(() => stat(path), 'the worktree is gone')
    await assert.rejects(() => stat(meta), 'the run meta is gone')
    await assert.rejects(() => stat(log), 'the event log is gone')
    assert.equal((await listAgents(repo)).some(r => r.id === RUN_ID), false, 'the row has left the list')
    // The branch and its commits are git history, deliberately left behind.
    const shown = await nodeGitRunner()(['rev-parse', '--verify', branch], repo)
    assert.match(shown, /^[0-9a-f]{40}/, 'the branch still exists')
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})

test('deleting discards uncommitted worktree work rather than committing it (#1032)', async () => {
  const { repo, path, branch } = await repoWithDirtyWorktree()
  try {
    await archiveAgent(repo, RUN_ID)
    // The worktree holds an uncommitted "Welcome!" edit. remove-worktree would commit it to the
    // branch; delete throws the session away, so the branch keeps only what it had committed.
    assert.deepEqual(await deleteProjectAgent(repo, RUN_ID), { ok: true })
    await assert.rejects(() => stat(path))
    const shown = await nodeGitRunner()(['show', `${branch}:index.html`], repo)
    assert.match(shown, /Hello, world!/, 'the branch keeps its committed content, not the discarded edit')
    assert.doesNotMatch(shown, /Welcome!/)
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})

test('deleting a record-only session (its worktree already gone) still clears the row (#1032)', async () => {
  const repo = await realpath(await mkdtemp(join(tmpdir(), 'framework-del-')))
  try {
    const { meta } = await archiveAgent(repo, 'run-x')
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
