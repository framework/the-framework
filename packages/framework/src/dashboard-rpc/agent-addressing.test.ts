import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { join } from 'node:path'
import { mkdtemp, rm, mkdir, writeFile, readFile, realpath } from 'node:fs/promises'
import { hostname, tmpdir } from 'node:os'
import { sendStop, sendMessage, sendChoice, sendRemoveWorktree } from './control.js'
import { onRetainedWorktrees, onAgents } from './reads.js'
import { addProject, projectId as idFor } from '../registry.js'
import { DATA_BRANCH, fileBranchPath, nodeGitRunner } from '@gemstack/agent-data'
import { worktreePath, addWorktree, agentBranchName } from '@gemstack/skill-branches'
import { THE_FRAMEWORK_DIR } from '../framework-dir.js'
import { RUN_INBOX_FILE } from '../dashboard/run-inbox.js'
import { PROJECT_HOOKS_FILE } from '../project-hooks.js'
import { provideTestContext } from './test-context.js'

// #749, #1774: what is addressed at a RUN has to resolve the run's own checkout, not the project:
// the run's card is there, and so is the inbox its tool reads. Addressed at the project root, a
// message reaches a file nobody reads.
//
// These run against the real registry, pointed at a temp $XDG_CONFIG_HOME so the user's own
// registry is never touched.

const QUESTION = { kind: 'question', title: 'Which way?', options: [{ id: 'a', label: 'Left' }, { id: 'b', label: 'Right' }] }

/** A project with one run in a checkout of its own. Returns its ids and the two candidate inbox paths. */
async function projectWithWorktreeAgent(
  owner: { pid: number; host: string } = { pid: 0, host: 'elsewhere' },
  run: { status?: string; diary?: unknown[]; hooks?: string } = {},
): Promise<{
  dir: string
  projectId: string
  agentId: string
  agentInbox: string
  rootInbox: string
  restore: () => void
}> {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'framework-addressing-')))
  const agentId = '2026-07-19T10-00-00-000Z'
  const worktree = worktreePath(dir, agentId)
  await mkdir(join(worktree, THE_FRAMEWORK_DIR), { recursive: true })
  // The run's card is what readLiveMetas discovers, and its id is what the caller addresses.
  await writeFile(
    join(worktree, THE_FRAMEWORK_DIR, `${agentId}.json`),
    JSON.stringify({ id: agentId, startedAt: '2026-07-19T10:00:00.000Z', status: run.status ?? 'running', caller: owner }),
  )
  await writeFile(join(worktree, THE_FRAMEWORK_DIR, `${agentId}.jsonl`), (run.diary ?? []).map(line => JSON.stringify(line) + '\n').join(''))
  if (run.hooks !== undefined) {
    await mkdir(join(dir, THE_FRAMEWORK_DIR), { recursive: true })
    await writeFile(join(dir, PROJECT_HOOKS_FILE), run.hooks)
  }

  const previous = process.env.XDG_CONFIG_HOME
  process.env.XDG_CONFIG_HOME = join(dir, 'cfg')
  await mkdir(process.env.XDG_CONFIG_HOME, { recursive: true })
  await addProject(dir, new Date().toISOString())
  // The context every RPC reads (D3). In tests it is a global that outlives an await,
  // unlike the request-scoped one a real serve() provides.
  provideTestContext()

  return {
    dir,
    projectId: idFor(dir),
    agentId,
    agentInbox: join(worktree, THE_FRAMEWORK_DIR, RUN_INBOX_FILE),
    rootInbox: join(dir, THE_FRAMEWORK_DIR, RUN_INBOX_FILE),
    restore: () => {
      if (previous === undefined) delete process.env.XDG_CONFIG_HOME
      else process.env.XDG_CONFIG_HOME = previous
    },
  }
}

/** A resume line that writes down what it was handed and answers the run's id. */
const RESUME_HOOK = `resume: 'printf "%s|%s|%s\\n" "$RUN_ID" "\${TEXT-}" "\${ANSWER-}" >> resumed.txt; echo "{\\"id\\":\\"$RUN_ID\\"}"'\n`

const entries = async (path: string): Promise<unknown[]> =>
  (await readFile(path, 'utf8').catch(() => ''))
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line) as unknown)

// Stop is a signal to the process the run's card names, whoever runs the agent. The card here
// names this test process, whose handler catches it.
test('sendStop signals the pid the run\'s card names, and writes nothing', async () => {
  const ctx = await projectWithWorktreeAgent({ pid: process.pid, host: hostname() })
  // A signal watcher does not keep the event loop alive: a bound timer holds it open until the
  // signal lands, and fails the test rather than letting the process drain with the wait pending.
  let signalled!: () => void
  const caught = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('no SIGINT within 5s')), 5000)
    signalled = () => {
      clearTimeout(timer)
      resolve()
    }
  })
  const onSignal = (): void => signalled()
  process.on('SIGINT', onSignal)
  try {
    await sendStop(ctx.projectId, ctx.agentId)
    await caught
    assert.deepEqual(await entries(ctx.agentInbox), [], 'a stop is not an inbox line')
    assert.deepEqual(await entries(ctx.rootInbox), [])
  } finally {
    process.off('SIGINT', onSignal)
    ctx.restore()
    await rm(ctx.dir, { recursive: true, force: true })
  }
})

test('sendStop leaves an agent alone whose process is not this machine\'s, or is gone', async () => {
  const elsewhere = await projectWithWorktreeAgent({ pid: process.pid, host: 'another-box' })
  try {
    const onSignal = (): void => assert.fail('signalled a pid on another host')
    process.on('SIGINT', onSignal)
    try {
      await sendStop(elsewhere.projectId, elsewhere.agentId)
      await new Promise(r => setTimeout(r, 50))
    } finally {
      process.off('SIGINT', onSignal)
    }
  } finally {
    elsewhere.restore()
    await rm(elsewhere.dir, { recursive: true, force: true })
  }
  // A dead pid on this host: nothing to signal, and nothing thrown.
  const dead = await projectWithWorktreeAgent({ pid: 2 ** 22 - 1, host: hostname() })
  try {
    await sendStop(dead.projectId, dead.agentId)
  } finally {
    dead.restore()
    await rm(dead.dir, { recursive: true, force: true })
  }
})

test('a message and an answer to a working run are lines in the inbox of the run\'s own checkout (#749/#1774)', async () => {
  // The card names this test process, so the run reads as working; its diary holds the question.
  const ctx = await projectWithWorktreeAgent({ pid: process.pid, host: hostname() }, { diary: [QUESTION], hooks: RESUME_HOOK })
  try {
    assert.deepEqual(await sendMessage(ctx.projectId, '  also add tests ', ctx.agentId), { ok: true })
    assert.deepEqual(await sendChoice(ctx.projectId, 'await-choices', 'b', ctx.agentId), { ok: true })
    assert.deepEqual(await entries(ctx.agentInbox), [
      { kind: 'message', text: 'also add tests' },
      { kind: 'answer', question: 'Which way?', answer: 'Right' },
    ])
    assert.deepEqual(await entries(ctx.rootInbox), [])
    assert.equal(await readFile(join(ctx.dir, 'resumed.txt'), 'utf8').catch(() => ''), '', 'a working run is not resumed')
    assert.deepEqual(await sendMessage(ctx.projectId, '   ', ctx.agentId), { ok: true }, 'an empty message is dropped')
    assert.equal((await entries(ctx.agentInbox)).length, 2)
  } finally {
    ctx.restore()
    await rm(ctx.dir, { recursive: true, force: true })
  }
})

test('a message and an answer to an ended run go through the project\'s resume hook; without the hook they are refused in words (#1774)', async () => {
  const waiting = await projectWithWorktreeAgent({ pid: 2 ** 22 - 1, host: hostname() }, { status: 'waiting', diary: [QUESTION, { kind: 'ended', status: 'waiting' }], hooks: RESUME_HOOK })
  try {
    assert.deepEqual(await sendChoice(waiting.projectId, 'await-choices', 'a', waiting.agentId), { ok: true })
    assert.deepEqual(await sendMessage(waiting.projectId, 'go on', waiting.agentId), { ok: true })
    assert.equal(await readFile(join(waiting.dir, 'resumed.txt'), 'utf8'), `${waiting.agentId}||Left\n${waiting.agentId}|go on|\n`)
    assert.deepEqual(await entries(waiting.agentInbox), [], 'nothing waits in an inbox nobody reads')
  } finally {
    waiting.restore()
    await rm(waiting.dir, { recursive: true, force: true })
  }
  const noHook = await projectWithWorktreeAgent({ pid: 2 ** 22 - 1, host: hostname() }, { status: 'done' })
  try {
    assert.deepEqual(await sendMessage(noHook.projectId, 'go on', noHook.agentId), { ok: false, error: 'this project has no resume hook' })
  } finally {
    noHook.restore()
    await rm(noHook.dir, { recursive: true, force: true })
  }
})

test('an answer must be to the question the run\'s diary holds open, by its own options (#1774)', async () => {
  const ctx = await projectWithWorktreeAgent({ pid: process.pid, host: hostname() }, { diary: [QUESTION, { kind: 'said', text: 'going on' }] })
  try {
    // The agent went on after the question: it is no longer open.
    assert.deepEqual(await sendChoice(ctx.projectId, 'await-choices', 'a', ctx.agentId), { ok: false, error: 'that question is no longer open' })
    await writeFile(join(worktreePath(ctx.dir, ctx.agentId), THE_FRAMEWORK_DIR, `${ctx.agentId}.jsonl`), JSON.stringify(QUESTION) + '\n')
    assert.deepEqual(await sendChoice(ctx.projectId, 'await-choices', 'zzz', ctx.agentId), { ok: false, error: 'every pick must be one of the question\'s options' })
    assert.deepEqual(await sendChoice(ctx.projectId, 'await-choices', ['a', 'b'], ctx.agentId), { ok: false, error: 'pick exactly one option' })
    assert.deepEqual(await entries(ctx.agentInbox), [])
  } finally {
    ctx.restore()
    await rm(ctx.dir, { recursive: true, force: true })
  }
})

test('a message with no run, or an unsafe run id, is refused (#749)', async () => {
  const ctx = await projectWithWorktreeAgent()
  try {
    assert.deepEqual(await sendMessage(ctx.projectId, 'one'), { ok: false, error: 'unknown session' })
    assert.deepEqual(await sendMessage(ctx.projectId, 'two', '../escape'), { ok: false, error: 'unknown session' })
    assert.deepEqual(await sendMessage('no-such-project', 'three', ctx.agentId), { ok: false, error: 'unknown session' })
    assert.deepEqual(await entries(ctx.rootInbox), [])
    assert.deepEqual(await entries(ctx.agentInbox), [], 'the run is left alone')
  } finally {
    ctx.restore()
    await rm(ctx.dir, { recursive: true, force: true })
  }
})

// #737: a failed agent keeps its worktree for inspection, so removing one is an explicit action —
// and must never yank the checkout out from under an agent that is still going.

test('sendRemoveWorktree refuses while that run is still live (#737)', async () => {
  const ctx = await projectWithWorktreeAgent() // its card says `running`
  try {
    const result = await sendRemoveWorktree(ctx.projectId, ctx.agentId)
    assert.equal(result.ok, false)
    assert.match(result.ok === false ? result.error : '', /still going/)
    assert.ok(await readFile(join(worktreePath(ctx.dir, ctx.agentId), THE_FRAMEWORK_DIR, `${ctx.agentId}.json`), 'utf8'), 'the worktree is untouched')
  } finally {
    ctx.restore()
    await rm(ctx.dir, { recursive: true, force: true })
  }
})

test('sendRemoveWorktree rejects an unsafe run id before touching anything (#737)', async () => {
  const ctx = await projectWithWorktreeAgent()
  try {
    const result = await sendRemoveWorktree(ctx.projectId, '../../etc')
    assert.equal(result.ok, false)
    assert.match(result.ok === false ? result.error : '', /invalid session id/)
  } finally {
    ctx.restore()
    await rm(ctx.dir, { recursive: true, force: true })
  }
})

// #982: the dashboard's Remove and the sweep are now one implementation, so the
// button gets the commit-first removal and the checks the CLI already had. Before that it went
// straight to a forcing removeWorktree, which deleted the very diff a retained checkout was kept
// for, and reported success for a session that had no worktree at all.

/** A registered project whose retained worktree holds an uncommitted edit, in a real git repo. */
async function projectWithDirtyWorktree(): Promise<{
  dir: string
  projectId: string
  agentId: string
  worktree: string
  branch: string
  restore: () => void
}> {
  const git = nodeGitRunner()
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'framework-remove-')))
  await git(['init'], dir)
  await git(['config', 'user.email', 't@t'], dir)
  await git(['config', 'user.name', 't'], dir)
  await writeFile(join(dir, 'index.html'), '<h1>Hello, world!</h1>\n')
  await git(['add', '-A'], dir)
  await git(['commit', '-m', 'init'], dir)
  // A real bare `origin`: the removal rule is "only what is on the remote may go" (E5), so the
  // checkout cannot be reclaimed without somewhere to push it.
  await git(['init', '-q', '--bare', join(dir, 'origin.git')], dir)
  await git(['remote', 'add', 'origin', join(dir, 'origin.git')], dir)

  const agentId = 'run1'
  const { path, branch } = await addWorktree(dir, { agentId, branch: agentBranchName(agentId) }, git)
  await writeFile(join(path, 'index.html'), '<h1>Welcome!</h1>\n')

  const previous = process.env.XDG_CONFIG_HOME
  process.env.XDG_CONFIG_HOME = join(dir, 'cfg')
  await mkdir(process.env.XDG_CONFIG_HOME, { recursive: true })
  await addProject(dir, new Date().toISOString())
  // The context every RPC reads (D3). In tests it is a global that outlives an await,
  // unlike the request-scoped one a real serve() provides.
  provideTestContext()

  return {
    dir,
    projectId: idFor(dir),
    agentId,
    worktree: path,
    branch,
    restore: () => {
      if (previous === undefined) delete process.env.XDG_CONFIG_HOME
      else process.env.XDG_CONFIG_HOME = previous
    },
  }
}

test('the dashboard Remove keeps a checkout holding uncommitted work, and says so (#982/E5/#1638)', async () => {
  const ctx = await projectWithDirtyWorktree()
  try {
    const result = await sendRemoveWorktree(ctx.projectId, ctx.agentId)
    assert.equal(result.ok, false)
    assert.match(result.ok === false ? result.error : '', /uncommitted work/)
    const git = nodeGitRunner()
    assert.match(await readFile(join(ctx.worktree, 'index.html'), 'utf8'), /Welcome!/, 'the edit is still in the checkout, uncommitted')
    await assert.rejects(() => git(['rev-parse', '--verify', `refs/remotes/origin/${ctx.branch}`], ctx.dir), 'and nothing reached the remote')
  } finally {
    ctx.restore()
    await rm(ctx.dir, { recursive: true, force: true })
  }
})

test('the dashboard Remove pushes and takes away a checkout whose agent committed (#982/E5)', async () => {
  const ctx = await projectWithDirtyWorktree()
  try {
    const git = nodeGitRunner()
    await git(['config', 'user.email', 't@t'], ctx.worktree)
    await git(['config', 'user.name', 't'], ctx.worktree)
    await git(['add', '-A'], ctx.worktree)
    await git(['commit', '-q', '-m', 'work'], ctx.worktree)
    assert.deepEqual(await sendRemoveWorktree(ctx.projectId, ctx.agentId), { ok: true })
    assert.match(await git(['show', `${ctx.branch}:index.html`], ctx.dir), /Welcome!/, 'the committed edit survived on the run branch')
    assert.match(
      await git(['show', `refs/remotes/origin/${ctx.branch}:index.html`], ctx.dir),
      /Welcome!/,
      'and reached the remote, which is what made the removal recoverable',
    )
  } finally {
    ctx.restore()
    await rm(ctx.dir, { recursive: true, force: true })
  }
})

test('the dashboard Remove reports an unknown session instead of claiming success (#982)', async () => {
  const ctx = await projectWithWorktreeAgent()
  try {
    const result = await sendRemoveWorktree(ctx.projectId, 'nosuchrun')
    assert.equal(result.ok, false)
    assert.match(result.ok === false ? result.error : '', /no worktree for session nosuchrun/)
  } finally {
    ctx.restore()
    await rm(ctx.dir, { recursive: true, force: true })
  }
})

test('onRetainedWorktrees hides a live run, and lists one that has finished (#737)', async () => {
  const ctx = await projectWithWorktreeAgent()
  try {
    assert.deepEqual(await onRetainedWorktrees(ctx.projectId), [], 'a running run has nothing to offer removing')
    // Once it is no longer running, its retained checkout is listed.
    await writeFile(
      join(worktreePath(ctx.dir, ctx.agentId), THE_FRAMEWORK_DIR, `${ctx.agentId}.json`),
      JSON.stringify({ id: ctx.agentId, startedAt: '2026-07-19T10:00:00.000Z', status: 'failed' }),
    )
    assert.deepEqual(await onRetainedWorktrees(ctx.projectId), [ctx.agentId])
  } finally {
    ctx.restore()
    await rm(ctx.dir, { recursive: true, force: true })
  }
})

// #768: a resumed run has a record from its first leg AND is going again in its checkout. The
// dedup used to keep the record and drop the live copy, so the dashboard showed a running agent as
// finished.
test('a resumed run reads as running, not as its recorded first leg (#768)', async () => {
  const ctx = await projectWithWorktreeAgent() // its checkout's card says `running`
  try {
    // Its first leg was recorded on the data branch when it ended.
    const recorded = join(fileBranchPath(ctx.dir, DATA_BRANCH), 'agents', 'someone@example.com')
    await mkdir(recorded, { recursive: true })
    await writeFile(join(recorded, `${ctx.agentId}.json`), JSON.stringify({ id: ctx.agentId, startedAt: '2026-07-19T10:00:00.000Z', status: 'waiting' }))
    const agents = (await onAgents(ctx.projectId)) as { id: string; status: string }[]
    const mine = agents.filter(agent => agent.id === ctx.agentId)
    assert.equal(mine.length, 1, 'still one row, not two')
    assert.equal(mine[0]?.status, 'running', 'and it reads as live, not as the recorded first leg')
  } finally {
    ctx.restore()
    await rm(ctx.dir, { recursive: true, force: true })
  }
})
