import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { readFile, mkdtemp, realpath, rm, stat, writeFile } from 'node:fs/promises'
import { removeMergedWorktrees, startMergedWorktreeSweep, type MergedSweepResult } from './merged-worktrees.js'
import { addWorktree, agentBranchName } from './store/index.js'
import { nodeGitRunner } from './project.js'
import type { WorktreeRow } from './worktrees.js'

// E5: one rule — a checkout may go once its work is on the remote, and not before. Every deletion
// is therefore recoverable, because the remote holds a copy. Three interacting rules used to decide
// this instead (a clean finish removes, a failure keeps, a merged branch reclaims later via two
// different "landed" signals), each asking how the session ended rather than whether the work is
// safe. The branch, the session's row and its replayable log are kept either way.

/** A sweep over fixed rows, recording which agent ids removal was asked for. */
function fakeSweep(rows: WorktreeRow[]) {
  const asked: string[] = []
  const agent = (over: { remove?: (cwd: string, agentId: string) => Promise<{ ok: true } | { ok: false; error: string }> } = {}) =>
    removeMergedWorktrees('/repo', {
      worktrees: async () => rows,
      hasRemote: async () => true,
      remove: async (cwd, agentId) => {
        asked.push(agentId)
        return over.remove ? over.remove(cwd, agentId) : { ok: true }
      },
    })
  return { asked, agent: agent }
}

const row = (over: Partial<WorktreeRow> & { agentId: string }): WorktreeRow => ({ live: false, ...over })

test('every retained checkout is offered to the one rule, whatever its run did (E5)', async () => {
  // No pre-filter by outcome: "failed" and "stopped" are not reasons to keep a checkout whose work
  // is already on the remote, and the removal itself is what refuses when it is not.
  const { asked, agent: agent } = fakeSweep([row({ agentId: 'done1', status: 'done' }), row({ agentId: 'failed1', status: 'failed' })])
  const result = await agent()
  assert.deepEqual(asked, ['done1', 'failed1'])
  assert.deepEqual(result.removed, [{ agentId: 'done1' }, { agentId: 'failed1' }])
  assert.deepEqual(result.failed, [])
})

test('a checkout the daemon has not finished with is left alone (E5)', async () => {
  // "Not live" on disk is not "the daemon is done with it": an agent's meta flips to `done` a beat
  // before its teardown archives the history and reclaims the checkout, so a sweep landing in that
  // window would race the teardown for the same directory.
  const asked: string[] = []
  const result = await removeMergedWorktrees('/repo', {
    worktrees: async () => [row({ agentId: 'retiring', status: 'done' }), row({ agentId: 'settled', status: 'done' })],
    busy: new Set(['retiring']),
    hasRemote: async () => true,
    remove: async (_cwd, agentId) => (asked.push(agentId), { ok: true }),
  })
  assert.deepEqual(asked, ['settled'])
  assert.deepEqual(result.removed, [{ agentId: 'settled' }])
})

test('a repo with no remote is asked once, and no checkout is probed for a doomed push (E5)', async () => {
  // The answer cannot change between two rows of the same sweep, so the per-checkout
  // commit-and-push cycle is skipped — while every retained checkout is still accounted for.
  const asked: string[] = []
  let remoteChecks = 0
  const result = await removeMergedWorktrees('/repo', {
    worktrees: async () => [row({ agentId: 'a' }), row({ agentId: 'b' })],
    hasRemote: async () => (remoteChecks++, false),
    remove: async (_cwd, agentId) => (asked.push(agentId), { ok: true }),
  })
  assert.equal(remoteChecks, 1)
  assert.deepEqual(asked, [])
  assert.deepEqual(result.removed, [])
  assert.deepEqual(result.failed, [
    { agentId: 'a', error: 'the repo has no remote; its worktree was kept' },
    { agentId: 'b', error: 'the repo has no remote; its worktree was kept' },
  ])
})

test('a live session keeps its checkout: its agent is working in there (#1036)', async () => {
  // Stop is how an agent ends, not pulling the floor out from under it.
  const { asked, agent: agent } = fakeSweep([row({ agentId: 'live', live: true, status: 'running' })])
  const { removed } = await agent()
  assert.deepEqual(removed, [])
  assert.deepEqual(asked, [])
})

test('a checkout that could not be reclaimed is reported with its reason (E5)', async () => {
  // The one failure mode the rule has: the push did not land, so the checkout stays and says why.
  const { agent: agent } = fakeSweep([row({ agentId: 'stuck' })])
  const result = await agent({ remove: async () => ({ ok: false, error: 'tf-agent-stuck is not on the remote' }) })
  assert.deepEqual(result.removed, [])
  assert.deepEqual(result.failed, [{ agentId: 'stuck', error: 'tf-agent-stuck is not on the remote' }])
})

test('an unlisted project sweeps nothing rather than failing (#1036)', async () => {
  const result = await removeMergedWorktrees('/repo', {
    worktrees: async () => {
      throw new Error('not a repo')
    },
  })
  assert.deepEqual(result, { removed: [], failed: [] })
})

// The sweep loop over projects.

test('the sweep says what it removed and what it kept, per project (#1036)', async () => {
  const lines: string[] = []
  const results: Record<string, MergedSweepResult> = {
    '/a': { removed: [{ agentId: 'r1' }], failed: [] },
    '/b': { removed: [{ agentId: 'r2', branchesDeleted: ['tf-triage-quick', 'tf-agent-r2'] }], failed: [{ agentId: 'r3', error: 'not on the remote' }] },
  }
  const sweep = startMergedWorktreeSweep({
    projects: async () => [{ path: '/a' }, { path: '/b' }],
    log: line => lines.push(line),
    sweep: async cwd => results[cwd] ?? { removed: [], failed: [] },
  })
  await sweep.tick()
  sweep.stop()
  assert.match(lines[0] ?? '', /removed the worktree for session r1: its branch is on the remote/)
  assert.match(lines[0] ?? '', /The branch and the session are kept/, 'a checkout vanishing silently reads as a bug')
  assert.match(lines[1] ?? '', /removed the worktree for session r2 and its branches tf-triage-quick and tf-agent-r2: nothing on it is missing elsewhere/, 'branches going say so (#1650, #1657)')
  assert.match(lines[2] ?? '', /kept the worktree for session r3: not on the remote/)
})

test('a kept checkout is accounted for once, not re-announced every turn (E5)', async () => {
  // A permanently unpushable checkout (no remote, a publish-nothing session) fails identically
  // every ten minutes for the life of the daemon; the line saying so is worth one print.
  const lines: string[] = []
  const sweep = startMergedWorktreeSweep({
    projects: async () => [{ path: '/a' }],
    log: line => lines.push(line),
    sweep: async () => ({ removed: [], failed: [{ agentId: 'r1', error: 'the repo has no remote; its worktree was kept' }] }),
  })
  await sweep.tick()
  await sweep.tick()
  sweep.stop()
  assert.equal(lines.filter(l => /kept the worktree for session r1/.test(l)).length, 1)
})

test('a changed keep reason is a changed state, and is said again (E5)', async () => {
  // Adding a remote turns "no remote" into "push failed on auth": the line must not stay
  // deduplicated on the checkout alone, or the new state never logs.
  const lines: string[] = []
  const outcomes: MergedSweepResult[] = [
    { removed: [], failed: [{ agentId: 'r1', error: 'the repo has no remote; its worktree was kept' }] },
    { removed: [], failed: [{ agentId: 'r1', error: 'tf-agent-r1 is not on the remote (auth failed); its worktree was kept' }] },
    { removed: [], failed: [{ agentId: 'r1', error: 'tf-agent-r1 is not on the remote (auth failed); its worktree was kept' }] },
  ]
  const sweep = startMergedWorktreeSweep({
    projects: async () => [{ path: '/a' }],
    log: line => lines.push(line),
    sweep: async () => outcomes.shift() ?? { removed: [], failed: [] },
  })
  await sweep.tick()
  await sweep.tick()
  await sweep.tick()
  sweep.stop()
  assert.equal(lines.filter(l => /kept the worktree for session r1/.test(l)).length, 2)
})

test('a removal clears the accounting, so a same-id checkout that reappears is announced again (E5)', async () => {
  const lines: string[] = []
  const outcomes: MergedSweepResult[] = [
    { removed: [], failed: [{ agentId: 'r1', error: 'the repo has no remote; its worktree was kept' }] },
    { removed: [{ agentId: 'r1' }], failed: [] },
    { removed: [], failed: [{ agentId: 'r1', error: 'the repo has no remote; its worktree was kept' }] },
  ]
  const sweep = startMergedWorktreeSweep({
    projects: async () => [{ path: '/a' }],
    log: line => lines.push(line),
    sweep: async () => outcomes.shift() ?? { removed: [], failed: [] },
  })
  await sweep.tick()
  await sweep.tick()
  await sweep.tick()
  sweep.stop()
  assert.equal(lines.filter(l => /kept the worktree for session r1/.test(l)).length, 2)
})

test('a stopped sweep does no further work (#1036)', async () => {
  let swept = 0
  const sweep = startMergedWorktreeSweep({
    projects: async () => [{ path: '/a' }],
    log: () => {},
    sweep: async () => (swept++, { removed: [], failed: [] }),
  })
  await sweep.tick()
  sweep.stop()
  await sweep.tick()
  assert.equal(swept, 1)
})

test('a project whose sweep throws does not stop the ones after it (#1036)', async () => {
  const swept: string[] = []
  const sweep = startMergedWorktreeSweep({
    projects: async () => [{ path: '/bad' }, { path: '/good' }],
    log: () => {},
    sweep: async cwd => {
      if (cwd === '/bad') throw new Error('nope')
      swept.push(cwd)
      return { removed: [], failed: [] }
    },
  })
  await sweep.tick()
  sweep.stop()
  assert.deepEqual(swept, ['/good'])
})

// Against real git, because "is the work still there afterwards" is not a question a fake answers.

const RUN_ID = 'run1'

/**
 * A repo with a session worktree that has a commit of its own on the agent branch, and a bare repo
 * standing in for `origin` — which is the whole subject here, so it is real rather than stubbed.
 */
async function repoWithAgentWork(opts: { remote?: boolean } = {}): Promise<{ repo: string; path: string; branch: string }> {
  const git = nodeGitRunner()
  // realpath so the mkdtemp path matches what git reports (the /var -> /private/var symlink).
  const repo = await realpath(await mkdtemp(join(tmpdir(), 'framework-merged-')))
  await git(['init'], repo)
  await git(['config', 'user.email', 't@t'], repo)
  await git(['config', 'user.name', 't'], repo)
  await writeFile(join(repo, 'index.html'), '<h1>Hello, world!</h1>\n')
  await git(['add', '-A'], repo)
  await git(['commit', '-m', 'init'], repo)
  if (opts.remote !== false) {
    const origin = join(repo, '..', `origin-${RUN_ID}-${repo.split('-').at(-1)}.git`)
    await git(['init', '-q', '--bare', origin], repo)
    await git(['remote', 'add', 'origin', origin], repo)
  }
  const { path, branch } = await addWorktree(repo, { agentId: RUN_ID, branch: agentBranchName(RUN_ID) }, git)
  await writeFile(join(path, 'index.html'), '<h1>Welcome!</h1>\n')
  await git(['add', '-A'], path)
  await git(['commit', '-m', 'the session did this'], path)
  return { repo, path, branch }
}

test('a session whose work reaches the remote loses its checkout and keeps its branch (E5)', async () => {
  const { repo, path, branch } = await repoWithAgentWork()
  const git = nodeGitRunner()
  try {
    const result = await removeMergedWorktrees(repo)

    assert.deepEqual(result.failed, [])
    assert.deepEqual(result.removed, [{ agentId: RUN_ID }])
    await assert.rejects(() => stat(path), 'the checkout is gone')
    // The half that makes this safe to do automatically: the work is in two places, not none.
    assert.equal((await git(['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`], repo)).trim().length, 40, 'the branch is kept')
    assert.match(await git(['log', '--format=%s', branch], repo), /the session did this/, 'the commit is on the branch')
    assert.match(
      await git(['log', '--format=%s', `refs/remotes/origin/${branch}`], repo),
      /the session did this/,
      'and on the remote, which is what let the checkout go',
    )
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})

test('a session with nowhere to push keeps its checkout (E5)', async () => {
  // No remote configured: nothing is recoverable, so nothing is deleted. The honest outcome, and
  // the reason the rule is "is it pushed" rather than "did it finish cleanly".
  const { repo, path } = await repoWithAgentWork({ remote: false })
  try {
    const result = await removeMergedWorktrees(repo)
    assert.deepEqual(result.removed, [])
    assert.equal(result.failed.length, 1)
    assert.match(result.failed[0]!.error, /no remote/)
    assert.ok((await stat(path)).isDirectory(), 'the checkout is still there')
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})

test('uncommitted work keeps its checkout: the sweep reports it and destroys nothing (#982/E5/#1638)', async () => {
  const { repo, path, branch } = await repoWithAgentWork()
  const git = nodeGitRunner()
  try {
    await writeFile(join(path, 'notes.txt'), 'something the agent had not committed\n')

    const result = await removeMergedWorktrees(repo)
    assert.deepEqual(result.removed, [])
    assert.equal(result.failed.length, 1)
    assert.match(result.failed[0]?.error ?? '', /uncommitted work/)
    assert.equal((await stat(path)).isDirectory(), true, 'the checkout is still on disk')
    assert.match(await readFile(join(path, 'notes.txt'), 'utf8'), /had not committed/, 'with the stray work still in it, uncommitted')
    await assert.rejects(() => git(['show', `${branch}:notes.txt`], repo), 'nothing was committed on the agent’s behalf')
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})

test("a checkout already pushed is not re-pushed, and still goes (E5)", async () => {
  const { repo, path, branch } = await repoWithAgentWork()
  const git = nodeGitRunner()
  try {
    await git(['push', '--set-upstream', 'origin', branch], path)
    assert.deepEqual((await removeMergedWorktrees(repo)).removed, [{ agentId: RUN_ID }])
    await assert.rejects(() => stat(path), 'the checkout is gone')
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})
