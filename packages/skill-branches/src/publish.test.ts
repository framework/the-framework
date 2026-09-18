import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { nodeGitRunner } from '@gemstack/agent-data'
import { createCheckout } from './checkout.js'
import { publishCheckout, type GhRunner } from './publish.js'
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
