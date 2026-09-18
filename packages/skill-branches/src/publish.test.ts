import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { nodeGitRunner } from '@gemstack/agent-data'
import { createCheckout } from './checkout.js'
import { publishCheckout, releaseMerge, type GhRunner } from './publish.js'
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
