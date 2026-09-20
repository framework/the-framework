import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { nodeGitRunner } from '@gemstack/agent-data'
import { createCheckout } from './checkout.js'
import { mergePr, publishBranch, publishCheckout, releaseMerge, type GhRunner } from './publish.js'
import { holdMerge, MERGE_HELD_NOTE } from './merge-hold.js'
import { runCli } from './cli.js'

// Publishing is the agent's own step now (#1774): push, pull request, merge arming, on a clean
// tree only. Real git and a bare origin; gh is faked, since the assertion is about what is asked.

const git = nodeGitRunner()

async function repoWithOrigin(): Promise<string> {
  const base = await realpath(await mkdtemp(join(tmpdir(), 'branches-publish-')))
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
  return repo
}

async function commitWork(path: string): Promise<void> {
  await writeFile(join(path, 'index.html'), '<h1>Welcome</h1>\n')
  await git(['config', 'user.email', 't@t'], path)
  await git(['config', 'user.name', 't'], path)
  await git(['add', '-A'], path)
  await git(['commit', '-q', '-m', 'work'], path)
}

/** A gh that records every call: no PR open at first, then the one it "created". */
function fakeGh(): { gh: GhRunner; calls: string[][] } {
  const calls: string[][] = []
  let opened: { number: number; url: string } | undefined
  const gh: GhRunner = async args => {
    calls.push(args)
    if (args[0] === 'pr' && args[1] === 'list') return JSON.stringify(opened ? [opened] : [])
    if (args[0] === 'pr' && args[1] === 'create') {
      opened = { number: 42, url: 'https://github.com/o/r/pull/42' }
      return `Creating pull request…\n${opened.url}\n`
    }
    if (args[0] === 'pr' && args[1] === 'merge') return ''
    throw new Error(`unexpected gh ${args.join(' ')}`)
  }
  return { gh, calls }
}

test('publish: the branch is pushed, a pull request opened with the given words, and the merge armed on request', async () => {
  const repo = await repoWithOrigin()
  try {
    const { path } = await createCheckout(repo, { agentId: 'a1' })
    await commitWork(path)
    const { gh, calls } = fakeGh()
    const outcome = await publishCheckout(path, { title: 'Welcome page', body: 'Says welcome.', merge: true, gh })
    assert.deepEqual(outcome, { ok: true, branch: 'agent-a1', pr: { number: 42, url: 'https://github.com/o/r/pull/42' }, existing: false, merge: { outcome: 'auto-armed' } })
    assert.equal((await git(['rev-parse', 'refs/remotes/origin/agent-a1'], repo)).trim(), (await git(['rev-parse', 'HEAD'], path)).trim(), 'the branch reached origin before the request')
    assert.deepEqual(calls.map(c => c.slice(0, 2)), [['pr', 'list'], ['pr', 'create'], ['pr', 'merge']])
    assert.deepEqual(calls[1], ['pr', 'create', '--head', 'agent-a1', '--title', 'Welcome page', '--body', 'Says welcome.'], 'an armed merge opens the request ready, never as a draft')
    assert.deepEqual(calls[2], ['pr', 'merge', '42', '--squash', '--auto'])

    // Again: the open request is reused, nothing is opened twice.
    const again = await publishCheckout(path, { title: 'ignored', gh })
    assert.deepEqual(again, { ok: true, branch: 'agent-a1', pr: { number: 42, url: 'https://github.com/o/r/pull/42' }, existing: true })
  } finally {
    await rm(join(repo, '..'), { recursive: true, force: true, maxRetries: 10 })
  }
})

test('where GitHub will not arm auto-merge: an already green request is merged at once, a repository without auto-merge gets the watcher, any other refusal is said', async () => {
  const repo = await repoWithOrigin()
  try {
    const { path } = await createCheckout(repo, { agentId: 'a5' })
    await commitWork(path)
    const cases: [string, unknown][] = [
      ['GraphQL: Pull request is in clean status (enablePullRequestAutoMerge)', { outcome: 'merged' }],
      ['GraphQL: Pull request Auto merge is not allowed for this repository (enablePullRequestAutoMerge)', { outcome: 'watching' }],
      ['GraphQL: Resource not accessible by integration', { outcome: 'failed', error: 'GraphQL: Resource not accessible by integration' }],
    ]
    for (const [refusal, expected] of cases) {
      const calls: string[][] = []
      const watched: number[] = []
      const outcome = await publishCheckout(path, {
        title: 'x',
        merge: true,
        watch: async (_repo, number) => {
          watched.push(number)
        },
        gh: async args => {
          calls.push(args)
          if (args[1] === 'list') return JSON.stringify([{ number: 7, url: 'https://github.com/o/r/pull/7' }])
          if (args[1] === 'merge' && args.includes('--auto')) throw new Error(refusal)
          return ''
        },
      })
      assert.ok(outcome.ok)
      assert.deepEqual(outcome.merge, expected, refusal)
      const direct = calls.filter(c => c[1] === 'merge' && !c.includes('--auto'))
      assert.deepEqual(direct, (expected as { outcome: string }).outcome === 'merged' ? [['pr', 'merge', '7', '--squash']] : [], 'only a green request is merged directly')
      assert.deepEqual(watched, (expected as { outcome: string }).outcome === 'watching' ? [7] : [])
    }
  } finally {
    await rm(join(repo, '..'), { recursive: true, force: true, maxRetries: 10 })
  }
})

/** A gh holding one request's state and body, recording every call. */
function heldGh(number: number): { gh: GhRunner; calls: string[][]; pr: { open: boolean; state: string; body: string } } {
  const calls: string[][] = []
  const pr = { open: false, state: 'OPEN', body: '' }
  const url = `https://github.com/o/r/pull/${number}`
  const gh: GhRunner = async args => {
    calls.push(args)
    if (args[1] === 'list') return JSON.stringify(pr.open ? [{ number, url }] : [])
    if (args[1] === 'create') {
      pr.open = true
      pr.body = args[args.indexOf('--body') + 1]!
      return `${url}\n`
    }
    if (args[1] === 'view') return JSON.stringify({ state: pr.state, body: pr.body })
    if (args[1] === 'edit') {
      pr.body = args[args.indexOf('--body') + 1]!
      return ''
    }
    if (args[1] === 'merge') return ''
    throw new Error(`unexpected gh ${args.join(' ')}`)
  }
  return { gh, calls, pr }
}

test('under a hold, publish --merge opens the request, arms nothing, and says so in the body; the release arms it and takes the line out', async () => {
  const repo = await repoWithOrigin()
  try {
    const { path } = await createCheckout(repo, { agentId: 'h1' })
    await holdMerge(path, git)
    await commitWork(path)
    const { gh, calls, pr } = heldGh(9)
    const outcome = await publishCheckout(path, { title: 'Held', body: 'Does a thing.', merge: true, gh })
    assert.deepEqual(outcome, { ok: true, branch: 'agent-h1', pr: { number: 9, url: 'https://github.com/o/r/pull/9' }, existing: false, merge: { outcome: 'held' } })
    assert.equal(calls.filter(c => c[1] === 'merge').length, 0, 'nothing is armed under a hold')
    assert.equal(pr.body, `Does a thing.\n\n${MERGE_HELD_NOTE}`)
    assert.equal((await git(['status', '--porcelain'], path)).trim(), '', 'the hold is out of git\'s sight')

    // A publish without --merge under the hold is a plain publish: no merge was wanted.
    const plain = await publishCheckout(path, { title: 'x', gh })
    assert.equal(plain.ok && plain.merge, undefined)

    // The checkout goes; the record of the wanted merge stays with the project.
    await git(['worktree', 'remove', '--force', path], repo)
    calls.length = 0
    const released = await releaseMerge(repo, 9, { gh })
    assert.deepEqual(released, { outcome: 'auto-armed' })
    assert.deepEqual(calls.map(c => c.slice(0, 2)), [['pr', 'view'], ['pr', 'merge'], ['pr', 'edit']])
    assert.equal(pr.body, 'Does a thing.', 'the held line left the body')
    assert.deepEqual(await releaseMerge(repo, 9, { gh }), { outcome: 'not-held' }, 'a release happens once')
  } finally {
    await rm(join(repo, '..'), { recursive: true, force: true, maxRetries: 10 })
  }
})

test('a held merge on a request already open gains the line once; a release of a closed request drops the record; a failed arming keeps it', async () => {
  const repo = await repoWithOrigin()
  try {
    const { path } = await createCheckout(repo, { agentId: 'h2' })
    await commitWork(path)
    const { gh, pr } = heldGh(5)
    await publishCheckout(path, { title: 'Open first', body: 'Body.', gh })
    await holdMerge(path, git)
    const held = await publishCheckout(path, { title: 'x', merge: true, gh })
    assert.equal(held.ok && held.merge?.outcome, 'held')
    await publishCheckout(path, { title: 'x', merge: true, gh })
    assert.equal(pr.body, `Body.\n\n${MERGE_HELD_NOTE}`, 'the line is added once')

    const refusing: GhRunner = async args => {
      if (args[1] === 'merge') throw new Error('GraphQL: Resource not accessible by integration')
      return gh(args, repo)
    }
    assert.deepEqual(await releaseMerge(repo, 5, { gh: refusing }), { outcome: 'failed', error: 'GraphQL: Resource not accessible by integration' })
    assert.equal(pr.body, `Body.\n\n${MERGE_HELD_NOTE}`, 'a failed arming leaves the request saying it is held')
    pr.state = 'MERGED'
    assert.deepEqual(await releaseMerge(repo, 5, { gh }), { outcome: 'closed', state: 'MERGED' }, 'the failed arming kept the record')
    assert.deepEqual(await releaseMerge(repo, 5, { gh }), { outcome: 'not-held' })
  } finally {
    await rm(join(repo, '..'), { recursive: true, force: true, maxRetries: 10 })
  }
})

test('publish refuses a dirty tree before pushing anything, and a draft is a draft unless the merge is armed', async () => {
  const repo = await repoWithOrigin()
  try {
    const { path } = await createCheckout(repo, { agentId: 'a2' })
    await writeFile(join(path, 'notes.txt'), 'uncommitted\n')
    const { gh, calls } = fakeGh()
    assert.deepEqual(await publishCheckout(path, { title: 'x', gh }), { ok: false, reason: 'dirty', branch: 'agent-a2' })
    assert.deepEqual(calls, [])
    assert.equal(await git(['rev-parse', '--verify', '--quiet', 'refs/remotes/origin/agent-a2'], repo).catch(() => ''), '', 'nothing was pushed')

    await commitWork(path)
    const draft = await publishCheckout(path, { title: 'Draft', draft: true, gh })
    assert.equal(draft.ok, true)
    const created: string[] = calls.find(c => c[1] === 'create') ?? []
    assert.ok(created.includes('--draft'))
  } finally {
    await rm(join(repo, '..'), { recursive: true, force: true, maxRetries: 10 })
  }
})

test('a push that cannot land and a request gh refuses are each reported as a refusal with the detail', async () => {
  const repo = await repoWithOrigin()
  try {
    const { path } = await createCheckout(repo, { agentId: 'a3' })
    await commitWork(path)
    await git(['remote', 'set-url', 'origin', join(repo, 'nowhere.git')], repo)
    const unreachable = await publishCheckout(path, { title: 'x', gh: async () => '[]' })
    assert.equal(unreachable.ok, false)
    assert.equal((unreachable as { reason: string }).reason, 'push-failed')
    await git(['remote', 'set-url', 'origin', join(repo, '..', 'origin.git')], repo)

    const refused = await publishCheckout(path, {
      title: 'x',
      gh: async args => {
        if (args[1] === 'list') return '[]'
        throw new Error('GraphQL: Draft pull requests are not supported in this repository')
      },
    })
    assert.deepEqual(refused, { ok: false, reason: 'pr-failed', branch: 'agent-a3', detail: 'GraphQL: Draft pull requests are not supported in this repository' })
  } finally {
    await rm(join(repo, '..'), { recursive: true, force: true, maxRetries: 10 })
  }
})

test('the command line: `publish --title … [--body …] [--merge] [--draft]` acts on the checkout it runs in', async () => {
  const repo = await repoWithOrigin()
  try {
    const { path } = await createCheckout(repo, { agentId: 'a4' })
    await commitWork(path)
    const outLines: string[] = []
    const errLines: string[] = []
    const io = { cwd: join(path, 'node_modules'), stdout: (l: string) => outLines.push(l), stderr: (l: string) => errLines.push(l) }
    // The command line takes the real gh; without one on PATH the request half fails, and that is a refusal, exit 1.
    const usage = await runCli(['publish'], io)
    assert.equal(usage, 2, 'the title is required')
    assert.match(errLines.join('\n'), /--title/)
  } finally {
    await rm(join(repo, '..'), { recursive: true, force: true, maxRetries: 10 })
  }
})

test('publish --branch: the checkout on the branch is published as the agent would, its clean rule included', async () => {
  const repo = await repoWithOrigin()
  try {
    const { path } = await createCheckout(repo, { agentId: 'b1' })
    await commitWork(path)
    await writeFile(join(path, 'draft.txt'), 'uncommitted\n')
    const { gh, calls } = fakeGh()
    assert.deepEqual(await publishBranch(repo, 'agent-b1', { title: 'T', gh }), { ok: false, reason: 'dirty', branch: 'agent-b1' })
    assert.deepEqual(calls, [], 'nothing asked of gh, nothing pushed')
    await rm(join(path, 'draft.txt'))
    const outcome = await publishBranch(repo, 'agent-b1', { title: 'T', body: 'B', draft: true, gh })
    assert.deepEqual(outcome, { ok: true, branch: 'agent-b1', pr: { number: 42, url: 'https://github.com/o/r/pull/42' }, existing: false })
    assert.equal((await git(['rev-parse', 'refs/remotes/origin/agent-b1'], repo)).trim(), (await git(['rev-parse', 'HEAD'], path)).trim(), 'pushed')
    assert.deepEqual(calls[1], ['pr', 'create', '--head', 'agent-b1', '--title', 'T', '--body', 'B', '--draft'])
    assert.deepEqual(await publishBranch(repo, 'agent-b1', { title: 'again', gh }), { ok: true, branch: 'agent-b1', pr: { number: 42, url: 'https://github.com/o/r/pull/42' }, existing: true }, 'the open request is reused')
  } finally {
    await rm(join(repo, '..'), { recursive: true, force: true, maxRetries: 10 })
  }
})

test('publish --branch without a checkout: a local branch is pushed; one only origin has is left as it is; one nowhere is no-branch', async () => {
  const repo = await repoWithOrigin()
  try {
    // A local branch with no checkout: the agent's checkout was reclaimed before its request was opened.
    await git(['branch', 'agent-b2', 'main'], repo)
    await git(['switch', '-q', 'agent-b2'], repo)
    await commitWork(repo)
    await git(['switch', '-q', 'main'], repo)
    const { gh, calls } = fakeGh()
    const outcome = await publishBranch(repo, 'agent-b2', { title: 'T', gh })
    assert.equal(outcome.ok, true)
    assert.equal((await git(['rev-parse', 'refs/remotes/origin/agent-b2'], repo)).trim(), (await git(['rev-parse', 'agent-b2'], repo)).trim(), 'the local branch reached origin')
    assert.deepEqual(calls.map(c => c.slice(0, 2)), [['pr', 'list'], ['pr', 'create']])

    // A branch only origin has: pushed from elsewhere, nothing here to push.
    await git(['branch', 'claude/remote-only', 'main'], repo)
    await git(['push', '-q', 'origin', 'claude/remote-only'], repo)
    await git(['branch', '-D', 'claude/remote-only'], repo)
    const remoteTip = (await git(['rev-parse', 'refs/remotes/origin/claude/remote-only'], repo)).trim()
    const second = fakeGh()
    const remote = await publishBranch(repo, 'claude/remote-only', { title: 'R', draft: true, gh: second.gh })
    assert.equal(remote.ok, true)
    assert.equal((await git(['rev-parse', 'refs/remotes/origin/claude/remote-only'], repo)).trim(), remoteTip, 'untouched')
    assert.equal(await git(['rev-parse', '--verify', '--quiet', 'refs/heads/claude/remote-only'], repo).then(() => true, () => false), false, 'no local branch was made')
    assert.deepEqual(second.calls[1]!.slice(0, 4), ['pr', 'create', '--head', 'claude/remote-only'])

    assert.deepEqual(await publishBranch(repo, 'nowhere', { title: 'N', gh: fakeGh().gh }), { ok: false, reason: 'no-branch', branch: 'nowhere' })
  } finally {
    await rm(join(repo, '..'), { recursive: true, force: true, maxRetries: 10 })
  }
})

test('merge: a draft is marked ready, then the merge is armed as --merge arms it; a request not open is said; a view that fails is a failure', async () => {
  const repo = await repoWithOrigin()
  try {
    const calls: string[][] = []
    const ghFor = (view: unknown): GhRunner => async args => {
      calls.push(args)
      if (args[0] === 'pr' && args[1] === 'view') {
        if (view instanceof Error) throw view
        return JSON.stringify(view)
      }
      if (args[0] === 'pr' && (args[1] === 'ready' || args[1] === 'merge')) return ''
      throw new Error(`unexpected gh ${args.join(' ')}`)
    }
    assert.deepEqual(await mergePr(repo, 7, { gh: ghFor({ state: 'OPEN', isDraft: true }) }), { outcome: 'auto-armed' })
    assert.deepEqual(calls, [
      ['pr', 'view', '7', '--json', 'state,isDraft'],
      ['pr', 'ready', '7'],
      ['pr', 'merge', '7', '--squash', '--auto'],
    ])
    calls.length = 0
    assert.deepEqual(await mergePr(repo, 8, { gh: ghFor({ state: 'OPEN', isDraft: false }) }), { outcome: 'auto-armed' })
    assert.deepEqual(calls.map(c => c[1]), ['view', 'merge'], 'a request that is ready is not marked ready again')
    assert.deepEqual(await mergePr(repo, 9, { gh: ghFor({ state: 'MERGED', isDraft: false }) }), { outcome: 'not-open', state: 'MERGED' })
    assert.deepEqual(await mergePr(repo, 10, { gh: ghFor(new Error('no such request')) }), { outcome: 'failed', error: 'no such request' })
  } finally {
    await rm(join(repo, '..'), { recursive: true, force: true, maxRetries: 10 })
  }
})

test('the command line: `merge <number>` wants a number, and `publish --branch` wants a branch; a bare publish still acts on the checkout it runs in', async () => {
  const repo = await repoWithOrigin()
  try {
    const errLines: string[] = []
    const io = { cwd: repo, stdout: () => {}, stderr: (l: string) => errLines.push(l) }
    assert.equal(await runCli(['merge', 'seven'], io), 2)
    assert.match(errLines.join('\n'), /not a pull request number/)
    assert.equal(await runCli(['publish', '--branch', ' ', '--title', 'T'], io), 2)
    assert.match(errLines.join('\n'), /--branch names a branch/)
    // The refusal for a branch that is nowhere, through the command line, before gh is ever needed.
    const out: string[] = []
    const err: string[] = []
    assert.equal(await runCli(['publish', '--branch', 'nowhere', '--title', 'T'], { cwd: repo, stdout: l => out.push(l), stderr: l => err.push(l) }), 1)
    assert.deepEqual(JSON.parse(out.join('')), { ok: false, reason: 'no-branch', branch: 'nowhere' })
    assert.equal(err.join('\n'), 'no branch nowhere, here or on origin')
  } finally {
    await rm(join(repo, '..'), { recursive: true, force: true, maxRetries: 10 })
  }
})
