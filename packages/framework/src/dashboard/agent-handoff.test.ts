import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { isAgentBranch } from '@better-skills/branch-management'
import { readAgentHandoff, resolveAgentPr, mergeAgentPr, agentBranchFor, openBranchPullRequest, openRemoteBranchPullRequest, openAgentPullRequest, agentAutoHandoff, prBaseName, withheldMerge } from './agent-handoff.js'
import { pickAgentPr } from './gh.js'
import { nodeGitRunner, type GitRunner } from '@better-skills/branch-management'

const exec = promisify(execFile)
const SEP = String.fromCharCode(31)

/** A GitRunner answering from a table, recording what it was asked. */
function fakeGit(answers: Record<string, string>): { git: GitRunner; calls: string[][] } {
  const calls: string[][] = []
  const git: GitRunner = async args => {
    calls.push(args)
    const key = args.join(' ')
    const hit = Object.entries(answers).find(([prefix]) => key.startsWith(prefix))
    if (!hit) throw new Error(`no stub for: ${key}`)
    return hit[1]
  }
  return { git, calls }
}

const REPO = { 'rev-parse --git-dir': '.git' }

test('the recorded branch wins; the birth branch is the only fallback (#799/#1725)', () => {
  assert.equal(agentBranchFor({ id: 'r1', branch: 'feat/mine' }), 'feat/mine')
  assert.equal(agentBranchFor({ id: 'r1', branch: 'agent-named' }), 'agent-named')
  assert.equal(agentBranchFor({ id: 'r1' }), 'agent-r1')
})

test('a non-repo yields no handoff at all', async () => {
  const { git } = fakeGit({})
  assert.equal(await readAgentHandoff('/nowhere', 'b', { git }), undefined)
})

test('a branch that no longer exists reports exists:false rather than failing', async () => {
  const { git } = fakeGit({ ...REPO, 'rev-parse --verify --quiet refs/heads/gone': '', remote: 'origin\n' })
  const handoff = await readAgentHandoff('/repo', 'gone', { git, pr: async () => undefined })
  assert.equal(handoff?.exists, false)
  assert.equal(handoff?.empty, true)
  assert.equal(handoff?.hasRemote, true)
})

test('a session that changed nothing is reported empty, not as an empty branch', async () => {
  const { git } = fakeGit({
    ...REPO,
    'rev-parse --verify --quiet refs/heads/the-framework/quiet': 'abc123\n',
    remote: 'origin\n',
    'symbolic-ref': 'origin/main\n',
    log: '',
    diff: '',
    'rev-parse --verify --quiet refs/remotes': '',
    branch: '',
  })
  const handoff = await readAgentHandoff('/repo', 'the-framework/quiet', { git, pr: async () => undefined })
  assert.equal(handoff?.empty, true)
  assert.deepEqual(handoff?.commits, [])
  assert.equal(handoff?.insertions, 0)
})

test('commits, files and line counts come back for a branch with work', async () => {
  const { git } = fakeGit({
    ...REPO,
    'rev-parse --verify --quiet refs/heads/the-framework/work': 'tip\n',
    remote: 'origin\n',
    'symbolic-ref': 'origin/main\n',
    log: `deadbeefcafe${SEP}add the thing\nfeedface1234${SEP}fix: a subject with spaces\n`,
    diff: '3\t1\tsrc/a.ts\n-\t-\tlogo.png\n',
    'rev-parse --verify --quiet refs/remotes/origin/the-framework/work': 'tip\n',
    branch: '',
  })
  const handoff = await readAgentHandoff('/repo', 'the-framework/work', { git, pr: async () => undefined })
  assert.equal(handoff?.empty, false)
  assert.equal(handoff?.base, 'origin/main')
  assert.deepEqual(
    handoff?.commits.map(c => [c.short, c.subject]),
    [
      ['deadbee', 'add the thing'],
      ['feedfac', 'fix: a subject with spaces'],
    ],
  )
  assert.equal(handoff?.insertions, 3)
  assert.equal(handoff?.deletions, 1)
  // A binary file is listed but contributes no line counts.
  assert.equal(handoff?.files.find(f => f.path === 'logo.png')?.binary, true)
  // The remote is at the same commit, so there is nothing to push.
  assert.equal(handoff?.pushed, true)
})

test('an unpushed branch and a repo with no remote are distinguished', async () => {
  const base = {
    ...REPO,
    'rev-parse --verify --quiet refs/heads/b': 'tip\n',
    'symbolic-ref': 'origin/main\n',
    log: `sha${SEP}s\n`,
    diff: '1\t0\ta.ts\n',
    branch: '',
  }
  const unpushed = await readAgentHandoff('/repo', 'b', {
    git: fakeGit({ ...base, remote: 'origin\n', 'rev-parse --verify --quiet refs/remotes': '' }).git,
    pr: async () => undefined,
  })
  assert.equal(unpushed?.hasRemote, true)
  assert.equal(unpushed?.pushed, false)

  const noRemote = await readAgentHandoff('/repo', 'b', {
    git: fakeGit({ ...base, remote: '' }).git,
    pr: async () => undefined,
  })
  assert.equal(noRemote?.hasRemote, false)
  assert.equal(noRemote?.pushed, false)
})

test('the PR is looked up for the session branch, not the checkout HEAD (#799)', async () => {
  const { git } = fakeGit({
    ...REPO,
    'rev-parse --verify --quiet refs/heads/the-framework/x': 'tip\n',
    remote: 'origin\n',
    'symbolic-ref': 'origin/main\n',
    log: `sha${SEP}s\n`,
    diff: '',
    'rev-parse --verify --quiet refs/remotes': '',
    branch: '',
  })
  const asked: string[] = []
  const handoff = await readAgentHandoff('/repo', 'the-framework/x', {
    git,
    pr: async (_cwd, branch) => {
      asked.push(branch)
      return { number: 7, url: 'https://example.test/7', state: 'OPEN', title: 'the pr' }
    },
  })
  assert.deepEqual(asked, ['the-framework/x'])
  assert.equal(handoff?.pr?.number, 7)
})

test('opening a PR pushes first and returns the URL gh printed', async () => {
  const pushes: string[][] = []
  const ghCalls: string[][] = []
  const result = await openBranchPullRequest(
    '/repo',
    'the-framework/x',
    { title: 'A title', body: 'A body', base: 'main' },
    {
      git: async args => {
        pushes.push(args)
        return ''
      },
      gh: async args => {
        ghCalls.push(args)
        return 'https://github.com/o/r/pull/12\n'
      },
    },
  )
  assert.deepEqual(result, { ok: true, url: 'https://github.com/o/r/pull/12', number: 12 })
  assert.deepEqual(pushes, [['push', '--set-upstream', 'origin', 'the-framework/x']])
  const args = ghCalls[0] ?? []
  assert.deepEqual(args.slice(0, 4), ['pr', 'create', '--head', 'the-framework/x'])
  assert.ok(args.includes('--base') && args.includes('main'))
  // Not a draft: the interventions queue (#632) lists open non-draft PRs as "needs you".
  assert.ok(!args.includes('--draft'))
})

test('a remote-only branch gets its draft PR without any push (#1601)', async () => {
  // A cloud session's `claude/*` branch was pushed from a VM this machine never sees: there is
  // nothing local to push, and gh's default base is the right one.
  const ghCalls: string[][] = []
  const result = await openRemoteBranchPullRequest(
    '/repo',
    { id: 'r1', branch: 'agent-fix-the-thing', intent: 'fix it' },
    'claude/fix-the-thing',
    {
      gh: async args => {
        ghCalls.push(args)
        return 'https://github.com/o/r/pull/13\n'
      },
    },
  )
  assert.deepEqual(result, { ok: true, url: 'https://github.com/o/r/pull/13', number: 13 })
  const args = ghCalls[0] ?? []
  assert.deepEqual(args.slice(0, 4), ['pr', 'create', '--head', 'claude/fix-the-thing'])
  assert.ok(args.includes('--draft'), 'a PR the framework opens by itself must not request review')
  assert.ok(!args.includes('--base'), "gh's default base is the repo's default branch")
})

test("the agent's own description becomes the PR body, in place of the intent (#1567)", async () => {
  // The `open-pr` capability: the agent describes what the change turned out to be, and the
  // framework opens the PR — so the agent has no reason to run `gh pr create` itself and lose
  // the title, the ticket's issue reference and the recorded number along with it.
  const ghCalls: string[][] = []
  await openRemoteBranchPullRequest(
    '/repo',
    { id: 'r1', branch: 'agent-fix-the-thing', intent: 'fix it', description: '## What changed\n\nThe queue reader keeps its state across a reload.' },
    'claude/fix-the-thing',
    {
      gh: async args => {
        ghCalls.push(args)
        return 'https://github.com/o/r/pull/14\n'
      },
    },
  )
  const body = (ghCalls[0] ?? [])[(ghCalls[0] ?? []).indexOf('--body') + 1] ?? ''
  assert.match(body, /The queue reader keeps its state across a reload\./)
  assert.doesNotMatch(body, /fix it/, "the agent's description replaces the opening intent rather than joining it")
  assert.match(body, /Opened from The Framework session/, 'the session line still rides along')
})

test('without a description the PR body still says what was asked for (#1567)', async () => {
  const ghCalls: string[][] = []
  await openRemoteBranchPullRequest('/repo', { id: 'r1', branch: 'agent-x', intent: 'fix it' }, 'claude/x', {
    gh: async args => {
      ghCalls.push(args)
      return 'https://github.com/o/r/pull/15\n'
    },
  })
  const body = (ghCalls[0] ?? [])[(ghCalls[0] ?? []).indexOf('--body') + 1] ?? ''
  assert.match(body, /fix it/)
})

test('a remote-only PR that gh refuses is a reported failure, never a throw (#1601)', async () => {
  const result = await openRemoteBranchPullRequest('/repo', { id: 'r1' }, 'claude/x', {
    gh: async () => {
      throw new Error('gh: no commits between main and claude/x')
    },
  })
  assert.equal(result.ok, false)
  assert.match(result.ok === false ? result.error : '', /no commits/)
})

test('a PR is not opened when the push fails', async () => {
  let ghRan = false
  const result = await openBranchPullRequest(
    '/repo',
    'b',
    { title: 't', body: 'b' },
    {
      git: async () => {
        throw new Error('remote rejected')
      },
      gh: async () => {
        ghRan = true
        return ''
      },
    },
  )
  assert.deepEqual(result, { ok: false, error: 'remote rejected' })
  assert.equal(ghRan, false)
})

test('a real repo: the branch outlives its worktree and still reports its work (#799)', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'handoff-'))
  const git = nodeGitRunner()
  try {
    await exec('git', ['init', '-b', 'main', dir])
    await exec('git', ['config', 'user.email', 'test@example.com'], { cwd: dir })
    await exec('git', ['config', 'user.name', 'Test'], { cwd: dir })
    await writeFile(join(dir, 'README.md'), 'base\n')
    await exec('git', ['add', '-A'], { cwd: dir })
    await exec('git', ['commit', '-m', 'base'], { cwd: dir })

    // A session's work, on its own branch, exactly as teardown leaves it.
    await exec('git', ['checkout', '-b', 'the-framework/demo'], { cwd: dir })
    await mkdir(join(dir, 'src'), { recursive: true })
    await writeFile(join(dir, 'src', 'app.ts'), 'export const a = 1\n')
    await exec('git', ['add', '-A'], { cwd: dir })
    await exec('git', ['commit', '-m', 'add the app'], { cwd: dir })
    await exec('git', ['checkout', 'main'], { cwd: dir })

    // Read from the project checkout, which is on main, about the session's branch.
    const handoff = await readAgentHandoff(dir, 'the-framework/demo', { git, pr: async () => undefined })
    assert.equal(handoff?.exists, true)
    assert.equal(handoff?.empty, false)
    assert.equal(handoff?.base, 'main')
    assert.deepEqual(handoff?.commits.map(c => c.subject), ['add the app'])
    assert.deepEqual(handoff?.files.map(f => f.path), ['src/app.ts'])
    assert.equal(handoff?.insertions, 1)
    assert.equal(handoff?.hasRemote, false)
    assert.equal(handoff?.merged, false)

    // And a branch already merged into the base says so.
    await exec('git', ['merge', '--no-ff', '-m', 'merge', 'the-framework/demo'], { cwd: dir })
    const merged = await readAgentHandoff(dir, 'the-framework/demo', { git, pr: async () => undefined })
    assert.equal(merged?.merged, true)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('a real repo: a branch whose work is already in the base reports empty (#1164/#1173)', async () => {
  // The bug this pins: the commit list used `base...branch`, git's SYMMETRIC difference, so a
  // branch that had produced nothing of its own still reported the commits that were only on the
  // base. `empty` stayed false, the dashboard offered Open PR, and GitHub refused it with
  // "No commits between main and <branch>" — an action that could only ever fail.
  const dir = await mkdtemp(join(tmpdir(), 'handoff-merged-'))
  const git = nodeGitRunner()
  try {
    await exec('git', ['init', '-b', 'main', dir])
    await exec('git', ['config', 'user.email', 'test@example.com'], { cwd: dir })
    await exec('git', ['config', 'user.name', 'Test'], { cwd: dir })
    await writeFile(join(dir, 'README.md'), 'base\n')
    await exec('git', ['add', '-A'], { cwd: dir })
    await exec('git', ['commit', '-m', 'base'], { cwd: dir })

    // The session branches off and commits nothing: its edit was never committed, which is the
    // shape an agent that forgets to commit leaves behind.
    await exec('git', ['branch', 'the-framework/demo'], { cwd: dir })
    // Meanwhile the base moves on, which is the ordinary case on a repo anyone else is working in.
    await writeFile(join(dir, 'README.md'), 'base, moved on\n')
    await exec('git', ['commit', '-am', 'someone else landed this'], { cwd: dir })

    const handoff = await readAgentHandoff(dir, 'the-framework/demo', { git, pr: async () => undefined })
    assert.equal(handoff?.exists, true)
    assert.deepEqual(handoff?.commits, [], 'the base\'s own commits are not this session\'s work')
    assert.equal(handoff?.empty, true, 'so there is nothing to open a PR for, and the bar says so')
    assert.deepEqual(handoff?.files, [])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

// The end-of-session handoff that fires by itself (#1102).

/** A branch with one commit, a remote, and no PR: the case a handoff should act on. */
const READY = {
  ...REPO,
  'rev-parse --verify --quiet refs/heads/the-framework/x': 'abc123\n',
  remote: 'origin\n',
  'symbolic-ref': 'origin/main\n',
  log: `abc123${SEP}abc${SEP}did the thing`,
  diff: '1\t0\tsrc/app.ts',
  'rev-parse --verify --quiet refs/remotes': '',
  branch: '',
}

test('an armed session opens a DRAFT PR, and pushes on the way (#1102)', async () => {
  const gh: string[][] = []
  const { git } = fakeGit({ ...READY, push: '' })
  const outcome = await agentAutoHandoff(
    '/repo',
    { id: 'r1', branch: 'the-framework/x', intent: 'build it' },
    { push: true, pr: true },
    {
      git,
      pr: async () => undefined,
      gh: async args => {
        gh.push(args)
        return 'https://github.com/o/r/pull/9\n'
      },
    },
  )
  assert.deepEqual(outcome, { outcome: 'done', pushed: true, url: 'https://github.com/o/r/pull/9', number: 9 })
  // The draft flag is the whole reason this is safe to fire on every session: without it every
  // finished run would put a review request in someone's inbox.
  assert.ok(gh[0]?.includes('--draft'), `expected --draft in ${JSON.stringify(gh[0])}`)
  assert.ok(gh[0]?.includes('the-framework/x'))
})

test('push armed alone pushes and opens nothing (#1102)', async () => {
  const pushes: string[][] = []
  const { git: read } = fakeGit(READY)
  const outcome = await agentAutoHandoff(
    '/repo',
    { id: 'r1', branch: 'the-framework/x' },
    { push: true, pr: false },
    {
      git: async (args, cwd) => {
        if (args[0] === 'push') {
          pushes.push(args)
          return ''
        }
        return read(args, cwd)
      },
      pr: async () => undefined,
      gh: async () => assert.fail('no PR should be opened when only the push is armed'),
    },
  )
  assert.deepEqual(outcome, { outcome: 'done', pushed: true })
  assert.deepEqual(pushes, [['push', '--set-upstream', 'origin', 'the-framework/x']])
})

test('a disarmed session hands off nothing at all (#1102)', async () => {
  const outcome = await agentAutoHandoff(
    '/repo',
    { id: 'r1', branch: 'the-framework/x' },
    { push: false, pr: false },
    { git: async () => assert.fail('a disarmed handoff must not touch git'), gh: async () => assert.fail('nor gh') },
  )
  assert.deepEqual(outcome, { outcome: 'skipped', reason: 'not-armed' })
})

test('a branch that already has a PR is never given a second one (#1102)', async () => {
  const { git } = fakeGit(READY)
  const outcome = await agentAutoHandoff(
    '/repo',
    { id: 'r1', branch: 'the-framework/x' },
    { push: true, pr: true },
    {
      git,
      pr: async () => ({ number: 4, url: 'https://github.com/o/r/pull/4', state: 'OPEN', title: 'already' }),
      gh: async () => assert.fail('opening a second PR is the one mistake this must not make'),
    },
  )
  assert.deepEqual(outcome, { outcome: 'skipped', reason: 'already-open' })
})

test('a session that kept working after its PR merged gets a fresh PR (#1512)', async () => {
  // The #1512 session: its PR merged mid-run, the user asked for more, the branch tip moved past
  // the merged head. "The branch already has a pull request" was how that work reached nobody.
  const gh: string[][] = []
  const { git } = fakeGit({ ...READY, push: '' })
  const outcome = await agentAutoHandoff(
    '/repo',
    { id: 'r1', branch: 'the-framework/x' },
    { push: true, pr: true },
    {
      git,
      pr: async () => ({ number: 1509, url: 'u1509', state: 'MERGED', title: 'landed', headRefOid: 'ffff00' }),
      gh: async args => (gh.push(args), 'https://github.com/o/r/pull/1513\n'),
    },
  )
  assert.equal(gh[0]?.[1], 'create')
  assert.deepEqual(outcome, { outcome: 'done', pushed: true, url: 'https://github.com/o/r/pull/1513', number: 1513 })
})

test('a merged PR whose head is still the branch tip means everything landed (#1512)', async () => {
  // READY's branch tip is abc123: a merged PR carrying that head covered all of the session's
  // work, so there is nothing left to publish — and the skip says landed, not "already has a PR".
  const { git } = fakeGit(READY)
  const outcome = await agentAutoHandoff(
    '/repo',
    { id: 'r1', branch: 'the-framework/x' },
    { push: true, pr: true },
    {
      git,
      pr: async () => ({ number: 1509, url: 'u1509', state: 'MERGED', title: 'landed', headRefOid: 'abc123' }),
      gh: async () => assert.fail('everything already landed: nothing to open'),
    },
  )
  assert.deepEqual(outcome, { outcome: 'skipped', reason: 'already-landed' })
})

test('a merged PR without a head to compare never risks a duplicate (#1512)', async () => {
  const { git } = fakeGit(READY)
  const outcome = await agentAutoHandoff(
    '/repo',
    { id: 'r1', branch: 'the-framework/x' },
    { push: true, pr: true },
    {
      git,
      pr: async () => ({ number: 1509, url: 'u1509', state: 'MERGED', title: 'landed' }),
      gh: async () => assert.fail('without the head the safe answer is to skip'),
    },
  )
  assert.deepEqual(outcome, { outcome: 'skipped', reason: 'already-landed' })
})

test('an armed merge follows the PR it just opened (#1216)', async () => {
  const gh: string[][] = []
  const { git } = fakeGit({ ...READY, push: '' })
  const outcome = await agentAutoHandoff(
    '/repo',
    { id: 'r1', branch: 'the-framework/x', intent: 'build it' },
    { push: true, pr: true, merge: true },
    {
      git,
      pr: async () => undefined,
      gh: async args => {
        gh.push(args)
        return args[1] === 'create' ? 'https://github.com/o/r/pull/9\n' : ''
      },
    },
  )
  // Auto-merge first: the PR lands when its checks pass, not before them.
  assert.deepEqual(gh[1], ['pr', 'merge', '9', '--squash', '--auto'])
  // Ready, not draft: GitHub refuses to merge drafts, so an armed merge and --draft are
  // mutually exclusive on the same PR.
  assert.ok(!gh[0]?.includes('--draft'), `expected no --draft in ${JSON.stringify(gh[0])}`)
  assert.deepEqual(outcome, {
    outcome: 'done',
    pushed: true,
    url: 'https://github.com/o/r/pull/9',
    number: 9,
    merge: { outcome: 'auto-armed' },
  })
})

test('without the merge flag the PR is left alone, exactly as before (#1216)', async () => {
  const gh: string[][] = []
  const { git } = fakeGit({ ...READY, push: '' })
  await agentAutoHandoff(
    '/repo',
    { id: 'r1', branch: 'the-framework/x' },
    { push: true, pr: true },
    { git, pr: async () => undefined, gh: async args => (gh.push(args), 'https://github.com/o/r/pull/9\n') },
  )
  assert.deepEqual(gh.map(args => args[1]), ['create'], 'no merge call without the flag')
})

test('a merge that fails is reported on a handoff that still succeeded (#1216)', async () => {
  // The PR exists either way; a human can still merge it by hand. Turning the refusal into a
  // failed handoff would misreport the half that worked.
  const { git } = fakeGit({ ...READY, push: '' })
  const outcome = await agentAutoHandoff(
    '/repo',
    { id: 'r1', branch: 'the-framework/x' },
    { push: true, pr: true, merge: true },
    {
      git,
      pr: async () => undefined,
      gh: async args => {
        if (args[1] === 'create') return 'https://github.com/o/r/pull/9\n'
        throw new Error('GraphQL: Base branch was modified')
      },
    },
  )
  assert.equal(outcome.outcome, 'done')
  assert.deepEqual('merge' in outcome ? outcome.merge : undefined, {
    outcome: 'failed',
    error: 'GraphQL: Base branch was modified',
  })
})

test('an armed merge takes the already-open PR a predecessor left (#1216)', async () => {
  // A daemon restart or rerun finds the PR its predecessor opened: the merge is the half that
  // has not happened yet, and the skip reason still says why no second PR was opened.
  const gh: string[][] = []
  const { git } = fakeGit(READY)
  const outcome = await agentAutoHandoff(
    '/repo',
    { id: 'r1', branch: 'the-framework/x' },
    { push: true, pr: true, merge: true },
    {
      git,
      pr: async () => ({ number: 4, url: 'https://github.com/o/r/pull/4', state: 'OPEN', title: 'already' }),
      gh: async args => (gh.push(args), ''),
    },
  )
  assert.deepEqual(gh, [['pr', 'merge', '4', '--squash', '--auto']])
  assert.deepEqual(outcome, { outcome: 'skipped', reason: 'already-open', merge: { outcome: 'auto-armed' } })
})

test('a session that committed nothing is not published (#1102)', async () => {
  const { git } = fakeGit({ ...READY, log: '', diff: '' })
  const outcome = await agentAutoHandoff(
    '/repo',
    { id: 'r1', branch: 'the-framework/x' },
    { push: true, pr: true },
    { git, pr: async () => undefined, gh: async () => assert.fail('nothing to open a PR for') },
  )
  assert.deepEqual(outcome, { outcome: 'skipped', reason: 'no-commits' })
})

test('a branch of pure framework bookkeeping is empty, and is not published (#1291)', async () => {
  // The observed junk PR: one "[The Framework] Uncommited changes" commit sweeping in the
  // conversation record the daemon wrote at start, and nothing else on the branch.
  const bookkeeping = {
    ...READY,
    log: `abc123${SEP}[The Framework] Uncommited changes`,
    diff: '21\t0\t.the-framework/conversations/2026-07-27T14-21-36-276Z.md\n2\t0\t.the-framework/LOGS.md',
  }
  const { git } = fakeGit(bookkeeping)
  const handoff = await readAgentHandoff('/repo', 'the-framework/x', { git, pr: async () => undefined })
  assert.equal(handoff?.empty, true, 'paper trail is provenance, not work')
  const outcome = await agentAutoHandoff(
    '/repo',
    { id: 'r1', branch: 'the-framework/x' },
    { push: true, pr: true },
    { git: fakeGit(bookkeeping).git, pr: async () => undefined, gh: async () => assert.fail('nothing to publish') },
  )
  assert.deepEqual(outcome, { outcome: 'skipped', reason: 'no-commits' })
})

test('bookkeeping alongside real work does not make a branch empty (#1291)', async () => {
  const { git } = fakeGit({
    ...READY,
    diff: '21\t0\t.the-framework/conversations/r1.md\n3\t1\tsrc/app.ts',
  })
  const handoff = await readAgentHandoff('/repo', 'the-framework/x', { git, pr: async () => undefined })
  assert.equal(handoff?.empty, false)
})

test('a repo with no remote is a skip, not a failure (#1102)', async () => {
  const { git } = fakeGit({ ...READY, remote: '' })
  const outcome = await agentAutoHandoff(
    '/repo',
    { id: 'r1', branch: 'the-framework/x' },
    { push: true, pr: true },
    { git, pr: async () => undefined, gh: async () => assert.fail('nowhere to push to') },
  )
  assert.deepEqual(outcome, { outcome: 'skipped', reason: 'no-remote' })
})

test('a failed push is reported with git’s own reason, so the bar can offer the retry (#1102)', async () => {
  const { git: read } = fakeGit(READY)
  const outcome = await agentAutoHandoff(
    '/repo',
    { id: 'r1', branch: 'the-framework/x' },
    { push: true, pr: false },
    {
      git: async (args, cwd) => {
        if (args[0] === 'push') throw new Error('Command failed: git push\nfatal: no write access\n')
        return read(args, cwd)
      },
      pr: async () => undefined,
    },
  )
  assert.deepEqual(outcome, { outcome: 'failed', step: 'push', error: 'fatal: no write access' })
})

test('a session branch is recognised by its prefix, a hand-made one is not (#1102)', () => {
  assert.equal(isAgentBranch('agent-x'), true)
  assert.equal(isAgentBranch('the-framework/x'), false) // the retired slashed spelling is nobody's
  assert.equal(isAgentBranch('feat/mine'), false)
})

test('the PR base is the remote branch name, not the tracking ref (#1102)', async () => {
  // Found by driving this against a real GitHub remote: `base` is `origin/main`, because that is
  // what the log range and the merged check need, but `gh pr create --base origin/main` is
  // rejected with "Base ref must be a branch". Pre-existing in #799's Open PR button; auto-handoff
  // made it fire on every session.
  assert.equal(prBaseName('origin/main'), 'main')
  assert.equal(prBaseName('main'), 'main') // the no-remote fallback is already a branch name
  assert.equal(prBaseName('origin/release/2.x'), 'release/2.x')

  const ghCalls: string[][] = []
  await openBranchPullRequest(
    '/repo',
    'the-framework/x',
    { title: 't', body: 'b', base: 'origin/main' },
    {
      git: async () => '',
      gh: async args => {
        ghCalls.push(args)
        return 'https://github.com/o/r/pull/1\n'
      },
    },
  )
  const at = ghCalls[0]?.indexOf('--base') ?? -1
  assert.notEqual(at, -1, 'the base should still be passed')
  assert.equal(ghCalls[0]?.[at + 1], 'main')
})

test('uncommitted work is counted from the session checkout, not the project (#1173)', async () => {
  const { git, calls } = fakeGit({
    ...REPO,
    'rev-parse --verify --quiet refs/heads/the-framework/dirty': 'abc123\n',
    remote: 'origin\n',
    'symbolic-ref': 'origin/main\n',
    log: '',
    diff: '',
    'rev-parse --verify --quiet refs/remotes': '',
    branch: '',
    status: ' M src/app.ts\n?? src/new.ts\n',
  })
  const handoff = await readAgentHandoff('/repo', 'the-framework/dirty', {
    git,
    pr: async () => undefined,
    checkout: '/repo/.the-framework/worktrees/r1',
  })
  // The branch really is empty; the work is real and sitting next to it. Both are true at once,
  // which is the whole of #1173 — and the paths are what the bar names instead of a dead button.
  assert.equal(handoff?.empty, true)
  assert.deepEqual(handoff?.pendingFiles, ['src/app.ts', 'src/new.ts'])
  assert.ok(calls.some(args => args[0] === 'status'), 'the checkout should have been asked')
})

test('pending is absent, not zero, when no session checkout was given (#1173)', async () => {
  const { git, calls } = fakeGit({
    ...REPO,
    'rev-parse --verify --quiet refs/heads/the-framework/quiet': 'abc123\n',
    remote: 'origin\n',
    'symbolic-ref': 'origin/main\n',
    log: '',
    diff: '',
    'rev-parse --verify --quiet refs/remotes': '',
    branch: '',
  })
  const handoff = await readAgentHandoff('/repo', 'the-framework/quiet', { git, pr: async () => undefined })
  // "Nobody asked" must not read as "asked, tree clean": only the second may be shown as a dead end.
  assert.equal(handoff?.pendingFiles, undefined)
  assert.ok(!calls.some(args => args[0] === 'status'), 'no checkout means no status read')
})

test('pickAgentPr trusts an open PR, and otherwise only one created after the run started (#1251)', () => {
  const stale = { number: 1177, url: 'u1177', state: 'MERGED', title: 'old triage', createdAt: '2026-07-25T16:55:18Z' }
  const own = { number: 1249, url: 'u1249', state: 'MERGED', title: 'this triage', createdAt: '2026-07-26T21:35:13Z' }
  const later = { number: 1300, url: 'u1300', state: 'MERGED', title: 'even later', createdAt: '2026-07-26T23:00:00Z' }
  const open = { number: 1301, url: 'u1301', state: 'OPEN', title: 'open one', createdAt: '2026-07-20T00:00:00Z' }
  const since = '2026-07-26T21:17:39.507Z'

  // The predecessor's merged PR is not this agent's, however recently gh lists it.
  assert.equal(pickAgentPr([stale], since), undefined)
  // The agent's own PR still counts after it merges, and the oldest post-start entry is the one
  // this agent opened.
  assert.equal(pickAgentPr([later, own, stale], since)?.number, 1249)
  // An open PR on the branch is where pushed commits land, whatever its age.
  assert.equal(pickAgentPr([stale, open], since)?.number, 1301)
  // Without a start time only an open PR is trusted.
  assert.equal(pickAgentPr([stale, own, later]), undefined)
  assert.equal(pickAgentPr([stale, open])?.number, 1301)
  // `latest` order (#1512): the handoff decision wants the PR that last saw the branch, so a
  // second PR's landed head is not mistaken for work the first PR never carried.
  assert.equal(pickAgentPr([later, own, stale], since, 'latest')?.number, 1300)
  assert.equal(pickAgentPr([stale, open], since, 'latest')?.number, 1301)
})

test('a gone branch still reports its PR: it is a remote question (#1255)', async () => {
  const { git } = fakeGit({ ...REPO, 'rev-parse --verify --quiet refs/heads/the-framework/agent-r1': '', remote: 'origin\n' })
  const handoff = await readAgentHandoff('/repo', 'the-framework/agent-r1', {
    git,
    pr: async () => ({ number: 1254, url: 'u1254', state: 'MERGED', title: 'web run', createdAt: '2026-07-26T21:52:58Z' }),
  })
  assert.equal(handoff?.exists, false)
  assert.equal(handoff?.pr?.number, 1254)
})

test('resolveAgentPr reads the PR the run recorded, and asks gh only for its state (E6)', async () => {
  // The number is a fact about the agent, written down when the PR was opened. It used to be
  // re-derived from three candidate branch names filtered by the agent's start time — a guess
  // assembled at read time, standing in for one integer nobody had recorded.
  const asked: (string | undefined)[] = []
  const prs = async (_cwd: string, branch?: string) => {
    asked.push(branch)
    return { value: { number: 1249, url: 'u1249', state: 'MERGED', title: 'this triage' }, pending: false }
  }
  const found = await resolveAgentPr('/repo', { id: 'r1', branch: 'feat/mine', pr: { number: 1249, url: 'u1249' } }, prs)
  assert.equal(found.value?.number, 1249)
  assert.equal(found.value?.state, 'MERGED', 'the state is read live, since it changes without the run doing anything')
  assert.deepEqual(asked, ['feat/mine'], 'one branch, not a ladder of candidates')
})

test('resolveAgentPr answers nothing for a run that recorded no PR (E6)', async () => {
  let asked = 0
  const found = await resolveAgentPr('/repo', { id: 'r1', branch: 'agent-named' }, async () => {
    asked++
    return { value: undefined, pending: false }
  })
  assert.equal(found.value, undefined)
  assert.equal(found.pending, false)
  assert.equal(asked, 0, 'and costs no gh read at all')
})

test('a recorded PR the live read cannot confirm still answers with its number and url (E6)', async () => {
  // A branch this machine cannot see — a hands-off web agent's, or one already deleted after merge.
  // The recorded fact is the answer; only its state is unknown.
  const found = await resolveAgentPr('/repo', { id: 'r1', pr: { number: 42, url: 'u42' } }, async () => ({
    value: undefined,
    pending: false,
  }))
  assert.equal(found.value?.number, 42)
  assert.equal(found.value?.url, 'u42')
  assert.equal(found.value?.state, 'UNKNOWN')
})

test('a different PR on the branch is not this run’s answer (E6)', async () => {
  const found = await resolveAgentPr('/repo', { id: 'r1', pr: { number: 42, url: 'u42' } }, async () => ({
    value: { number: 99, url: 'u99', state: 'OPEN', title: 'someone else’s' },
    pending: false,
  }))
  assert.equal(found.value?.number, 42, 'the recorded number wins over whatever is on the branch now')
})

test('withheldMerge authorizes only a declared-done session with an empty session TODO (#1363)', () => {
  // The rule settled on #1390: config arms the merge, the agent authorizes it. No signal means
  // no merge, whatever else is true — this is what row 3 of the live matrix proved was missing
  // (the daemon merged 3s after the PR opened, with setReadyForMerge never called).
  assert.equal(withheldMerge({ readyForMerge: false, agentTodoOpen: false }), 'not-ready-for-merge')
  assert.equal(withheldMerge({ readyForMerge: false, agentTodoOpen: true }), 'not-ready-for-merge')
  // The temporary safety belt: the agent said done but its own session file says otherwise.
  assert.equal(withheldMerge({ readyForMerge: true, agentTodoOpen: true }), 'session-todo-open')
  // Declared done, nothing pending in this session: the merge may run.
  assert.equal(withheldMerge({ readyForMerge: true, agentTodoOpen: false }), undefined)
})

test("a run implementing a ticket carries its issue as `(fix #42)` in the PR title (#1334)", async () => {
  // The squash-merge subject inherits the title, so this is what closes the ticket's issue on
  // merge; without it an auto-merged quick-win leaves its ticket open.
  assert.equal(await titleOf({ id: 'r1', branch: 'agent-fix-login', fixes: '#42' }), 'fix-login (fix #42)')
})

async function titleOf(agent: Parameters<typeof agentAutoHandoff>[1]): Promise<string | undefined> {
  const gh: string[][] = []
  const { git } = fakeGit({ ...READY, [`rev-parse --verify --quiet refs/heads/${agent.branch ?? 'the-framework/x'}`]: 'abc123\n', push: '' })
  await agentAutoHandoff('/repo', agent, { push: true, pr: true }, {
    git,
    pr: async () => undefined,
    gh: async args => {
      gh.push(args)
      return 'https://github.com/o/r/pull/9\n'
    },
  })
  return gh[0]?.[gh[0].indexOf('--title') + 1]
}

test("the PR is titled with the agent's own name for the work (#1618)", async () => {
  // The first line of its `open-pr` block: the one rung that says what the change turned out to
  // be, in a whole sentence, rather than the slug the session happens to be called.
  const title = await titleOf({
    id: 'r1',
    branch: 'agent-queue-reader',
    prTitle: 'Keep the queued state across a reload',
    fixes: '#42',
  })
  assert.equal(title, 'Keep the queued state across a reload (fix #42)')
})

test('a session that named nothing gets its id as the title, not the prompt it was given (#1618)', async () => {
  // The prompt used to be the middle rung, cut to 72 characters. The squash merge made that a
  // permanent commit subject: an instruction, truncated mid-sentence, standing in for a
  // description of the change. The session id says less and misleads nobody.
  const intent = 'Open TODO_AGENTS.md and work on the FIRST open entry only. When the work is done, close the ticket it links to.'
  assert.equal(await titleOf({ id: 'r1', branch: 'the-framework/x', intent }), 'Session r1')
  assert.equal(await titleOf({ id: 'r1', branch: 'the-framework/x', intent, fixes: '#1' }), 'Session r1 (fix #1)')
})

test("the Merge action merges the session's open PR, marking a draft ready on the way (#1391)", async () => {
  const gh: string[][] = []
  const result = await mergeAgentPr(
    '/repo',
    { id: 'r1', branch: 'the-framework/x', pr: { number: 7, url: 'https://github.com/o/r/pull/7' } },
    {
      prs: async () => ({ value: { number: 7, url: 'https://github.com/o/r/pull/7', state: 'OPEN', title: 'x' }, pending: false }),
      gh: async args => (gh.push(args), ''),
    },
  )
  // ghMergePr's ladder: auto-merge first, so the PR lands when its checks pass. The draft case
  // (gh refuses, `pr ready`, retry) is ghMergePr's own tested behavior and rides along here.
  assert.deepEqual(gh[0], ['pr', 'merge', '7', '--squash', '--auto'])
  assert.deepEqual(result, { ok: true, url: 'https://github.com/o/r/pull/7', number: 7 })
})

test('the Merge action refuses a session with no PR, or one already landed (#1391)', async () => {
  const none = await mergeAgentPr('/repo', { id: 'r1' }, { prs: async () => ({ value: undefined, pending: false }) })
  assert.deepEqual(none, { ok: false, error: 'this session has no pull request to merge' })
  // A closed/merged PR is an answer, not an action: nothing to press twice.
  const landed = await mergeAgentPr(
    '/repo',
    { id: 'r1', branch: 'the-framework/x', pr: { number: 7, url: 'u' } },
    { prs: async () => ({ value: { number: 7, url: 'u', state: 'MERGED', title: 'x' }, pending: false }) },
  )
  assert.deepEqual(landed, { ok: false, error: "this session's PR is already merged" })
})

test('a Merge the remote refuses comes back as the error, not a success (#1391)', async () => {
  const result = await mergeAgentPr(
    '/repo',
    { id: 'r1', branch: 'the-framework/x', pr: { number: 7, url: 'u' } },
    {
      prs: async () => ({ value: { number: 7, url: 'u', state: 'OPEN', title: 'x' }, pending: false }),
      gh: async () => {
        throw new Error('Pull request is not mergeable: the base branch requires review')
      },
    },
  )
  assert.equal(result.ok, false)
  assert.match((result as { error: string }).error, /not mergeable/)
})
