import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { nodeGitRunner } from '@gemstack/skill-branches'
import { runCli, USAGE } from './cli.js'
import { TICKETS_BRANCH } from './names.js'

const git = nodeGitRunner()
const RETRIED_RM = { recursive: true, force: true, maxRetries: 10 } as const

/** A bare origin with a `tickets` branch holding two tickets, plus N clones acting as agents. */
async function rig(clones: number) {
  const bare = await realpath(await mkdtemp(join(tmpdir(), 'tickets-cli-bare-')))
  await git(['init', '--bare', '-b', 'main', bare], bare)
  const seed = await realpath(await mkdtemp(join(tmpdir(), 'tickets-cli-seed-')))
  await git(['clone', bare, seed], seed)
  await git(['config', 'user.email', 's@s'], seed)
  await git(['config', 'user.name', 's'], seed)
  await writeFile(join(seed, 'README.md'), '# t\n')
  await git(['add', '-A'], seed)
  await git(['commit', '-m', 'init'], seed)
  await git(['push', 'origin', 'main'], seed)
  const commit = (await git(['commit-tree', '4b825dc642cb6eb9a060e54bf8d69288fbee4904', '-m', 'create the tickets branch'], seed)).trim()
  await git(['checkout', '-B', TICKETS_BRANCH, commit], seed)
  await mkdir(join(seed, 'tickets'))
  await writeFile(join(seed, 'tickets', '2026-08-30_a.md'), 'Priority: 8\n\n# A\n\n## TLDR\n\nThe first.\n')
  await writeFile(join(seed, 'tickets', '2026-08-29_b.md'), '# B\n')
  await writeFile(join(seed, 'tickets', '2026-08-29_b.plan.md'), 'Effort: 1\n\n# [Plan] B\n')
  await writeFile(join(seed, 'TODO_AGENTS.md'), '## Priority 5\n\n- [Do B](tickets/2026-08-29_b.md)\n')
  await git(['add', '-A'], seed)
  await git(['commit', '-m', 'seed'], seed)
  await git(['push', 'origin', TICKETS_BRANCH], seed)
  const agents: string[] = []
  for (let i = 0; i < clones; i++) {
    const parent = await realpath(await mkdtemp(join(tmpdir(), `tickets-cli-agent${i}-`)))
    const clone = join(parent, 'clone')
    await git(['clone', bare, clone], parent)
    await git(['config', 'user.email', `a${i}@a`], clone)
    await git(['config', 'user.name', `a${i}`], clone)
    await git(['checkout', '-b', `agent-a${i}`], clone)
    agents.push(clone)
  }
  const cleanup = async () => {
    for (const dir of [bare, seed, ...agents.map(a => join(a, '..'))]) await rm(dir, RETRIED_RM)
  }
  return { bare, seed, agents, cleanup }
}

/** Run one command, capturing the contract: parsed stdout, stderr lines, exit code. */
async function run(cwd: string, argv: string[], stdin = '') {
  const out: string[] = []
  const err: string[] = []
  const code = await runCli(argv, { cwd, stdin: async () => stdin, stdout: line => out.push(line), stderr: line => err.push(line) })
  return { code, json: out.length ? JSON.parse(out.join('\n')) : undefined, stderr: err.join('\n') }
}

test('reads: list, show and queue come off origin, and a missing ticket is a refusal', async () => {
  const { agents, cleanup } = await rig(1)
  const [a] = agents
  try {
    const list = await run(a!, ['list'])
    assert.equal(list.code, 0)
    assert.deepEqual(list.json.map((t: { file: string; priority?: string; planned: boolean; effort?: number }) => [t.file, t.priority, t.planned, t.effort]), [
      ['2026-08-30_a.md', '8', false, undefined],
      ['2026-08-29_b.md', undefined, true, 1],
    ])
    const show = await run(a!, ['show', '2026-08-29_b.md'])
    assert.equal(show.code, 0)
    assert.equal(show.json.ticket.content, '# B\n')
    assert.match(show.json.plan, /^Effort: 1/)
    assert.equal(show.json.holder, undefined)
    // The ticket may be named by its path too.
    assert.equal((await run(a!, ['show', 'tickets/2026-08-29_b.md'])).code, 0)
    const queue = await run(a!, ['queue'])
    assert.deepEqual(queue.json, ['[Do B](tickets/2026-08-29_b.md)'])
    const missing = await run(a!, ['show', '2026-08-28_nope.md'])
    assert.equal(missing.code, 1)
    assert.deepEqual(missing.json, { ok: false, reason: 'no-ticket', file: '2026-08-28_nope.md' })
    assert.match(missing.stderr, /no ticket tickets\/2026-08-28_nope.md/)
    const bad = await run(a!, ['show', '../x.md'])
    assert.equal(bad.json.reason, 'invalid-path')
    // Usage: an unknown command, a wrong argument count.
    const unknown = await run(a!, ['dance'])
    assert.equal(unknown.code, 2)
    assert.equal(unknown.stderr, USAGE)
    assert.equal((await run(a!, ['show'])).code, 2)
  } finally {
    await cleanup()
  }
})

test('claim writes the lock as one pushed commit naming the holder; the second claimer is refused with the holder; release lifts it', async () => {
  const { bare, agents, cleanup } = await rig(2)
  const [a, b] = agents
  try {
    const first = await run(a!, ['claim', '2026-08-30_a.md'])
    assert.equal(first.code, 0)
    assert.deepEqual(first.json, { ok: true, file: 'tickets/2026-08-30_a.md', holder: 'agent-a0' })
    assert.equal(await git(['show', `${TICKETS_BRANCH}:tickets/2026-08-30_a.lock.md`], bare), 'CLAIMED: agent-a0\n')
    assert.equal((await git(['log', '-1', '--format=%s %an', TICKETS_BRANCH], bare)).trim(), 'claim tickets/2026-08-30_a a0')
    // The agent's own clone holds no local copy of the branch: the write was a remote writer's.
    await assert.rejects(git(['rev-parse', '--verify', TICKETS_BRANCH], a!))
    assert.equal((await git(['status', '--porcelain'], a!)).trim(), '', 'nothing lands in the agent\'s checkout')
    // A second claimer, from another clone, back to back: refused, told who holds it.
    const second = await run(b!, ['claim', '2026-08-30_a.md'])
    assert.equal(second.code, 1)
    assert.deepEqual(second.json, { ok: false, reason: 'claimed', holder: 'agent-a0', file: '2026-08-30_a.md' })
    assert.match(second.stderr, /claimed by agent-a0/)
    // Exactly one lock commit on the remote.
    assert.equal((await git(['rev-list', '--count', TICKETS_BRANCH], bare)).trim(), '3')
    // The holder shows up on the reads.
    const show = await run(b!, ['show', '2026-08-30_a.md'])
    assert.equal(show.json.holder, 'agent-a0')
    assert.equal(show.json.ticket.lockedBy, 'agent-a0')
    // Claiming again yourself is fine: the lock is yours already.
    assert.equal((await run(a!, ['claim', '2026-08-30_a.md'])).code, 0)
    // Only the holder may release.
    const notMine = await run(b!, ['release', '2026-08-30_a.md'])
    assert.equal(notMine.code, 1)
    assert.deepEqual(notMine.json, { ok: false, reason: 'not-holder', file: '2026-08-30_a.md', holder: 'agent-a0' })
    const mine = await run(a!, ['release', '2026-08-30_a.md'])
    assert.equal(mine.code, 0)
    await assert.rejects(git(['show', `${TICKETS_BRANCH}:tickets/2026-08-30_a.lock.md`], bare))
    assert.deepEqual((await run(a!, ['release', '2026-08-30_a.md'])).json, { ok: false, reason: 'no-lock', file: '2026-08-30_a.md' })
    // Now b gets it.
    assert.equal((await run(b!, ['claim', '2026-08-30_a.md'])).json.holder, 'agent-a1')
    // A ticket that does not exist cannot be claimed.
    assert.equal((await run(b!, ['claim', '2026-08-28_nope.md'])).json.reason, 'no-ticket')
  } finally {
    await cleanup()
  }
})

test('the holder is the agent id inside a .branches/agent-<id> checkout, the branch elsewhere, and nobody when detached', async () => {
  const { agents, cleanup } = await rig(1)
  const [a] = agents
  try {
    // The project's checkout with an agent checkout under `.branches/`, as a daemon lays it out.
    const wt = join(a!, '.branches', 'agent-2026-08-30T10-00-00-000Z')
    await git(['worktree', 'add', wt, '-b', 'agent-2026-08-30T10-00-00-000Z'], a!)
    const fromCheckout = await run(wt, ['claim', '2026-08-30_a.md'])
    assert.equal(fromCheckout.json.holder, '2026-08-30T10-00-00-000Z')
    // The id survives the session's rename: the directory keeps it, the branch does not.
    await git(['branch', '-m', 'agent-2026-08-30T10-00-00-000Z', 'agent-named'], wt)
    assert.equal((await run(wt, ['release', '2026-08-30_a.md'])).json.holder, '2026-08-30T10-00-00-000Z')
    // Detached: nothing to claim as.
    await git(['checkout', '--detach'], a!)
    const detached = await run(a!, ['claim', '2026-08-30_a.md'])
    assert.equal(detached.code, 1)
    assert.deepEqual(detached.json, { ok: false, reason: 'no-identity' })
  } finally {
    await cleanup()
  }
})

test('put writes a ticket, a plan or meta.json from stdin, never a lock; close removes the ticket with its siblings', async () => {
  const { bare, agents, cleanup } = await rig(1)
  const [a] = agents
  try {
    const put = await run(a!, ['put', '2026-08-31_c.md'], '# C\n')
    assert.deepEqual(put.json, { ok: true, file: 'tickets/2026-08-31_c.md' })
    assert.equal(await git(['show', `${TICKETS_BRANCH}:tickets/2026-08-31_c.md`], bare), '# C\n')
    assert.equal((await git(['log', '-1', '--format=%s', TICKETS_BRANCH], bare)).trim(), 'put tickets/2026-08-31_c.md')
    assert.equal((await run(a!, ['put', '2026-08-31_c.plan.md'], 'Effort: 2\n\n# [Plan] C\n')).code, 0)
    assert.equal((await run(a!, ['put', 'meta.json'], '{"lastImportedAt":"2026-08-31T00:00:00.000Z"}')).code, 0)
    assert.equal(await git(['show', `${TICKETS_BRANCH}:tickets/meta.json`], bare), '{"lastImportedAt":"2026-08-31T00:00:00.000Z"}')
    for (const bad of ['2026-08-31_c.lock.md', '../x.md', 'sub/x.md', 'x.txt']) {
      const refused = await run(a!, ['put', bad], 'x')
      assert.equal(refused.code, 1, bad)
      assert.equal(refused.json.reason, 'invalid-path', bad)
    }
    // The new ticket lists, planned.
    const listed = (await run(a!, ['list'])).json.find((t: { file: string }) => t.file === '2026-08-31_c.md')
    assert.equal(listed.planned, true)
    assert.equal(listed.effort, 2)
    await run(a!, ['claim', '2026-08-31_c.md'])
    // Closing takes the lock with the ticket, so someone else's claim refuses the close.
    const otherParent = await realpath(await mkdtemp(join(tmpdir(), 'tickets-cli-other-')))
    try {
      const b = join(otherParent, 'clone')
      await git(['clone', bare, b], otherParent)
      await git(['config', 'user.email', 'b@b'], b)
      await git(['config', 'user.name', 'b'], b)
      await git(['checkout', '-b', 'agent-b'], b)
      await run(b, ['claim', '2026-08-30_a.md'])
      const theirs = await run(a!, ['close', '2026-08-30_a.md'])
      assert.equal(theirs.code, 1)
      assert.deepEqual(theirs.json, { ok: false, reason: 'not-holder', holder: 'agent-b', file: '2026-08-30_a.md' })
    } finally {
      await rm(otherParent, RETRIED_RM)
    }
    const closed = await run(a!, ['close', '2026-08-31_c.md'])
    assert.deepEqual(closed.json, { ok: true, file: 'tickets/2026-08-31_c.md' })
    const left = (await git(['ls-tree', '--name-only', `${TICKETS_BRANCH}:tickets`], bare)).split('\n').filter(Boolean)
    // b's claim on a.md stands: the close touched c's files only.
    assert.deepEqual(left.sort(), ['2026-08-29_b.md', '2026-08-29_b.plan.md', '2026-08-30_a.lock.md', '2026-08-30_a.md', 'meta.json'])
    assert.equal((await run(a!, ['close', '2026-08-31_c.md'])).json.reason, 'no-ticket')
  } finally {
    await cleanup()
  }
})

test('queue add places an entry by priority, links a ticket by --ticket, and queue done deletes the line', async () => {
  const { bare, agents, cleanup } = await rig(1)
  const [a] = agents
  try {
    const added = await run(a!, ['queue', 'add', 'Tidy the loader', '--priority', '3'])
    assert.deepEqual(added.json, { ok: true, entry: 'Tidy the loader', priority: 3 })
    // By ticket: a link back to it, placed by the ticket's own priority (a is 8).
    const linked = await run(a!, ['queue', 'add', 'Do A', '--ticket', '2026-08-30_a.md'])
    assert.deepEqual(linked.json, { ok: true, entry: '[Do A](tickets/2026-08-30_a.md)', priority: 8 })
    const plain = await run(a!, ['queue', 'add', 'Last, unranked'])
    assert.deepEqual(plain.json, { ok: true, entry: 'Last, unranked' })
    const md = await git(['show', `${TICKETS_BRANCH}:TODO_AGENTS.md`], bare)
    assert.equal(md, '## Priority 8\n\n- [Do A](tickets/2026-08-30_a.md)\n\n## Priority 5\n\n- [Do B](tickets/2026-08-29_b.md)\n\n## Priority 3\n\n- Tidy the loader\n- Last, unranked\n')
    assert.equal((await git(['log', '-1', '--format=%s', TICKETS_BRANCH], bare)).trim(), 'queue add: Last, unranked')
    assert.deepEqual((await run(a!, ['queue'])).json, ['[Do A](tickets/2026-08-30_a.md)', '[Do B](tickets/2026-08-29_b.md)', 'Tidy the loader', 'Last, unranked'])
    const done = await run(a!, ['queue', 'done', '[Do B](tickets/2026-08-29_b.md)'])
    assert.deepEqual(done.json, { ok: true, entry: '[Do B](tickets/2026-08-29_b.md)' })
    assert.ok(!(await git(['show', `${TICKETS_BRANCH}:TODO_AGENTS.md`], bare)).includes('Do B'))
    assert.ok(!(await git(['show', `${TICKETS_BRANCH}:TODO_AGENTS.md`], bare)).includes('[x]'), 'deleted, not checked off')
    const gone = await run(a!, ['queue', 'done', 'never there'])
    assert.equal(gone.code, 1)
    assert.equal(gone.json.reason, 'no-entry')
    assert.equal((await run(a!, ['queue', 'add', 'x', '--priority', '11'])).code, 2)
    assert.equal((await run(a!, ['queue', 'add', 'x', '--ticket', 'nope.md'])).json.reason, 'no-ticket')
  } finally {
    await cleanup()
  }
})

test('a repository with no remote reads its local branch and refuses to write; outside a repository is a refusal', async () => {
  const solo = await realpath(await mkdtemp(join(tmpdir(), 'tickets-cli-solo-')))
  try {
    await git(['init', '-b', 'main'], solo)
    await git(['config', 'user.email', 's@s'], solo)
    await git(['config', 'user.name', 's'], solo)
    await writeFile(join(solo, 'README.md'), '# t\n')
    await git(['add', '-A'], solo)
    await git(['commit', '-m', 'init'], solo)
    const commit = (await git(['commit-tree', '4b825dc642cb6eb9a060e54bf8d69288fbee4904', '-m', 'create the tickets branch'], solo)).trim()
    await git(['branch', TICKETS_BRANCH, commit], solo)
    assert.deepEqual((await run(solo, ['list'])).json, [])
    const refused = await run(solo, ['queue', 'add', 'x'])
    assert.equal(refused.code, 1)
    assert.deepEqual(refused.json, { ok: false, reason: 'no-remote' })
    const outside = await run(tmpdir(), ['list'])
    assert.equal(outside.code, 1)
    assert.deepEqual(outside.json, { ok: false, reason: 'not-a-repo' })
  } finally {
    await rm(solo, RETRIED_RM)
  }
})
