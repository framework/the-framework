import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ghMergePr, ghPrCiStatus, ghPrList, ghPrView, ghRepoAutoMerge, githubToken } from './gh.js'
import type { GhRunner } from './gh.js'

/** A `gh` that answers with `stdout`, or rejects, and records what it was asked. */
function fakeGh(stdout: string | Error): { gh: GhRunner; calls: string[][] } {
  const calls: string[][] = []
  const gh: GhRunner = async args => {
    calls.push(args)
    if (stdout instanceof Error) throw stdout
    return stdout
  }
  return { gh, calls }
}

test('GH_TOKEN wins over the gh CLI, which is not consulted at all', async () => {
  // CI sets the variable and must beat whatever gh happens to be logged in as on the runner.
  const { gh, calls } = fakeGh('gho_from_cli\n')
  assert.equal(await githubToken('/repo', { GH_TOKEN: 'ghp_from_env' }, gh), 'ghp_from_env')
  assert.deepEqual(calls, [])
})

test('GITHUB_TOKEN is honoured too, as the second environment spelling', async () => {
  const { gh } = fakeGh('gho_from_cli\n')
  assert.equal(await githubToken('/repo', { GITHUB_TOKEN: 'ghp_from_env' }, gh), 'ghp_from_env')
})

test('with no token in the environment, the gh CLI credential is used (#1352)', async () => {
  // The point of the change: a machine whose gh can already open PRs can run an Actions session,
  // instead of failing with the credential sitting one `gh auth token` away.
  const { gh, calls } = fakeGh('gho_from_cli\n')
  assert.equal(await githubToken('/repo', {}, gh), 'gho_from_cli')
  assert.deepEqual(calls, [['auth', 'token']])
})

test('a gh that is missing, logged out, or refusing yields no token rather than throwing', async () => {
  // The caller turns undefined into the agent's stated reason; a rejection here would instead
  // surface as an unhandled failure deep in the start path.
  const { gh } = fakeGh(new Error('gh: command not found'))
  assert.equal(await githubToken('/repo', {}, gh), undefined)
})

test('an empty or blank gh answer is no token, not an empty-string one', async () => {
  // `gh auth token` prints nothing when logged out of the active host. An empty string would sail
  // past the caller's `if (!token)` check as a real credential and fail later, at the API.
  assert.equal(await githubToken('/repo', {}, fakeGh('').gh), undefined)
  assert.equal(await githubToken('/repo', {}, fakeGh('  \n').gh), undefined)
})

test('an empty environment variable falls through to the CLI rather than counting as a token', async () => {
  // `GH_TOKEN=` in a shell profile is the same as unset, and used to be treated as a real value.
  const { gh } = fakeGh('gho_from_cli\n')
  assert.equal(await githubToken('/repo', { GH_TOKEN: '' }, gh), 'gho_from_cli')
})

test('ghMergePr arms GitHub auto-merge, so the PR lands when its checks pass (#1216)', async () => {
  const { gh, calls } = fakeGh('')
  assert.deepEqual(await ghMergePr('/repo', 9, gh), { outcome: 'auto-armed' })
  assert.deepEqual(calls, [['pr', 'merge', '9', '--squash', '--auto']])
})

test('a repo that does not allow auto-merge gets the direct merge instead (#1216)', async () => {
  // gh surfaces GitHub's GraphQL refusal verbatim; both known spellings carry the
  // enablePullRequestAutoMerge marker.
  for (const refusal of [
    'GraphQL: Pull request Auto merge is not allowed for this repository (enablePullRequestAutoMerge)',
    'GraphQL: Pull request is in clean status (enablePullRequestAutoMerge)',
  ]) {
    const calls: string[][] = []
    const gh: GhRunner = async args => {
      calls.push(args)
      if (args.includes('--auto')) throw new Error(refusal)
      return ''
    }
    assert.deepEqual(await ghMergePr('/repo', 9, gh), { outcome: 'merged' })
    assert.deepEqual(calls, [
      ['pr', 'merge', '9', '--squash', '--auto'],
      ['pr', 'merge', '9', '--squash'],
    ])
  }
})

test('any other refusal is reported, not retried as a direct merge (#1216)', async () => {
  // A merge conflict, a permissions problem, a network failure: retrying those without --auto
  // would either fail again or, worse, land a PR GitHub just said not to.
  const { gh, calls } = fakeGh(new Error('GraphQL: Pull request is not mergeable'))
  assert.deepEqual(await ghMergePr('/repo', 9, gh), {
    outcome: 'failed',
    error: 'GraphQL: Pull request is not mergeable',
  })
  assert.deepEqual(calls, [['pr', 'merge', '9', '--squash', '--auto']])
})

test('a draft PR is marked ready and the auto-merge retried (#1216)', async () => {
  // The already-open path can find a draft a previous agent's handoff left behind. GitHub refuses
  // to merge or auto-merge drafts, so the draft refusal means ready-then-retry, not failure.
  const calls: string[][] = []
  let drafted = true
  const gh: GhRunner = async args => {
    calls.push(args)
    if (args[1] === 'ready') {
      drafted = false
      return ''
    }
    if (drafted) throw new Error('GraphQL: Pull request is in draft state and cannot be merged')
    return ''
  }
  assert.deepEqual(await ghMergePr('/repo', 9, gh), { outcome: 'auto-armed' })
  assert.deepEqual(calls, [
    ['pr', 'merge', '9', '--squash', '--auto'],
    ['pr', 'ready', '9'],
    ['pr', 'merge', '9', '--squash', '--auto'],
  ])
})

test('a readied draft still falls through to the direct merge where auto-merge is not allowed (#1216)', async () => {
  let drafted = true
  const calls: string[][] = []
  const gh: GhRunner = async args => {
    calls.push(args)
    if (args[1] === 'ready') {
      drafted = false
      return ''
    }
    if (drafted) throw new Error('GraphQL: Pull request is in draft state and cannot be merged')
    if (args.includes('--auto')) throw new Error('Pull request Auto merge is not allowed for this repository')
    return ''
  }
  assert.deepEqual(await ghMergePr('/repo', 9, gh), { outcome: 'merged' })
  assert.deepEqual(calls.at(-1), ['pr', 'merge', '9', '--squash'])
})

test('a direct merge that also fails reports the second refusal (#1216)', async () => {
  const gh: GhRunner = async args => {
    if (args.includes('--auto')) throw new Error('Pull request Auto merge is not allowed for this repository')
    throw new Error('GraphQL: Base branch was modified')
  }
  assert.deepEqual(await ghMergePr('/repo', 9, gh), {
    outcome: 'failed',
    error: 'GraphQL: Base branch was modified',
  })
})

/** A `gh` whose `pr view` answers with the given rollup, and refuses `--auto` like a repo without auto-merge. */
function watchModeGh(rollup: unknown[], calls: string[][] = []): GhRunner {
  return async args => {
    calls.push(args)
    if (args.includes('--auto')) throw new Error('Pull request Auto merge is not allowed for this repository')
    if (args[1] === 'view') return JSON.stringify({ statusCheckRollup: rollup, headRefOid: 'abc1234', headRefName: 'the-framework/x' })
    return ''
  }
}

test('ghPrCiStatus summarises check runs: all green is passing, one failure names itself (#1418)', async () => {
  const green = watchModeGh([
    { name: 'build', status: 'COMPLETED', conclusion: 'SUCCESS' },
    { name: 'lint', status: 'COMPLETED', conclusion: 'SKIPPED' },
  ])
  assert.deepEqual(await ghPrCiStatus('/repo', 9, green), {
    checks: 'passing',
    failed: [],
    headSha: 'abc1234',
    branch: 'the-framework/x',
  })

  const red = watchModeGh([
    { name: 'build', status: 'COMPLETED', conclusion: 'FAILURE' },
    { name: 'test', status: 'IN_PROGRESS', conclusion: null },
  ])
  // A concluded failure is failing even while other checks still run: more green cannot unsay it.
  assert.equal((await ghPrCiStatus('/repo', 9, red)).checks, 'failing')
  assert.deepEqual((await ghPrCiStatus('/repo', 9, red)).failed, ['build'])
})

test('ghPrCiStatus: still-running checks are pending, classic commit statuses count too (#1418)', async () => {
  const pending = watchModeGh([{ name: 'build', status: 'IN_PROGRESS', conclusion: null }])
  assert.equal((await ghPrCiStatus('/repo', 9, pending)).checks, 'pending')
  // A classic status has no `status` field: its `state` is both progress and verdict.
  const classicPending = watchModeGh([{ context: 'ci/legacy', state: 'PENDING' }])
  assert.equal((await ghPrCiStatus('/repo', 9, classicPending)).checks, 'pending')
  const classicRed = watchModeGh([{ context: 'ci/legacy', state: 'FAILURE' }])
  assert.deepEqual((await ghPrCiStatus('/repo', 9, classicRed)).failed, ['ci/legacy'])
})

test('ghPrCiStatus: an empty rollup is none, and an unreadable gh is none too — never a green (#1418)', async () => {
  assert.equal((await ghPrCiStatus('/repo', 9, watchModeGh([]))).checks, 'none')
  const { gh } = fakeGh(new Error('gh: command not found'))
  assert.deepEqual(await ghPrCiStatus('/repo', 9, gh), { checks: 'none', failed: [] })
})

test('watch mode: a refusal with checks still running answers watched, and merges nothing (#1418)', async () => {
  // The #1406 hazard this exists for: the direct fallback used to land the PR before its first
  // check ran. In watch mode the daemon's CI sweep merges it once the checks pass.
  const calls: string[][] = []
  const gh = watchModeGh([{ name: 'build', status: 'IN_PROGRESS', conclusion: null }], calls)
  assert.deepEqual(await ghMergePr('/repo', 9, gh, { whenUnarmed: 'watch' }), { outcome: 'watched' })
  assert.ok(!calls.some(args => args[1] === 'merge' && !args.includes('--auto')))
})

test('watch mode: a refusal with checks already green merges directly — nothing to wait for (#1418)', async () => {
  const calls: string[][] = []
  const gh = watchModeGh([{ name: 'build', status: 'COMPLETED', conclusion: 'SUCCESS' }], calls)
  assert.deepEqual(await ghMergePr('/repo', 9, gh, { whenUnarmed: 'watch' }), { outcome: 'merged' })
  assert.deepEqual(calls.at(-1), ['pr', 'merge', '9', '--squash'])
})

test('watch mode: no checks reported defers to the watch — a suite takes seconds to attach (#1418)', async () => {
  assert.deepEqual(await ghMergePr('/repo', 9, watchModeGh([]), { whenUnarmed: 'watch' }), { outcome: 'watched' })
})

test('ghRepoAutoMerge reads the repo setting, and an unreadable answer is unknown, not "off" (#1417)', async () => {
  const { gh, calls } = fakeGh('{"allow_auto_merge":false}')
  assert.deepEqual(await ghRepoAutoMerge('/repo', gh), { known: true, allowed: false })
  assert.deepEqual(calls, [['api', 'repos/{owner}/{repo}']])

  const { gh: allowed } = fakeGh('{"allow_auto_merge":true}')
  assert.deepEqual(await ghRepoAutoMerge('/repo', allowed), { known: true, allowed: true })

  // gh missing / unauthenticated / not a GitHub repo: "could not say" renders nothing on the
  // launcher — the no-crying-wolf (#1318) stance — so it must never masquerade as a real "off".
  const { gh: broken } = fakeGh(new Error('gh: command not found'))
  assert.deepEqual(await ghRepoAutoMerge('/repo', broken), { known: false, allowed: false })
  const { gh: junk } = fakeGh('not json')
  assert.deepEqual(await ghRepoAutoMerge('/repo', junk), { known: false, allowed: false })
  // REST omits allow_auto_merge for viewers without push access — absent is unknown too.
  const { gh: noField } = fakeGh('{"full_name":"acme/repo"}')
  assert.deepEqual(await ghRepoAutoMerge('/repo', noField), { known: false, allowed: false })
})

// #1334, found by dogfooding: `PR_VIEW_FIELDS` asked for `number,url,state,title` only, and the
// copy-out below it dropped anything else anyway. So every caller of this path got a `LinkedPr`
// with no `createdAt` — and the CI watch reads exactly that to decide whether a check-less PR has
// outlived the window a check suite takes to attach. With the age unknowable, such a PR was never
// merged at all: an armed auto-merge on a repo without CI hung open forever.
//
// Both tests go through the real field list on purpose. The bug survived because every ci-watch
// test injects its own PR lookup, so the one thing that was wrong — what this function asks `gh`
// for, and what it keeps of the answer — was the one thing nothing exercised.
test('the PR read asks gh for every field LinkedPr carries (#1334)', async () => {
  const { gh, calls } = fakeGh('{}')
  await ghPrView('/repo', 'tf-thing', gh)
  const fields = calls[0]?.[calls[0].indexOf('--json') + 1] ?? ''
  for (const field of ['number', 'url', 'state', 'title', 'createdAt', 'headRefOid'])
    assert.ok(fields.split(',').includes(field), `--json must ask for ${field}, got "${fields}"`)
})

test('the PR read keeps the creation time the CI watch decides on (#1334)', async () => {
  const { gh } = fakeGh(
    JSON.stringify({
      number: 2,
      url: 'https://github.com/o/r/pull/2',
      state: 'OPEN',
      title: 'Add a LICENSE file',
      createdAt: '2026-08-21T10:47:50Z',
      headRefOid: 'f1789c5ebaab4cfb79e4ea214508daee147a4092',
    }),
  )
  const pr = await ghPrView('/repo', 'tf-thing', gh)
  assert.equal(pr?.createdAt, '2026-08-21T10:47:50Z')
  assert.equal(pr?.headRefOid, 'f1789c5ebaab4cfb79e4ea214508daee147a4092')
})

test('a field gh does not answer with is absent rather than undefined-valued', async () => {
  // The copy-out stays conditional: a PR read that came back without a creation time must not
  // manufacture the key, or "we do not know" becomes indistinguishable from "it has none".
  const { gh } = fakeGh(JSON.stringify({ number: 2, url: 'u', state: 'OPEN', title: 't' }))
  const pr = await ghPrView('/repo', 'tf-thing', gh)
  assert.ok(pr && !('createdAt' in pr), 'createdAt must not be present when gh did not answer with it')
})

test('ghPrList reports a gh that could not answer, rather than calling it an empty queue (#1623)', async () => {
  // Every other read here forgives its own failure. This one must not: its caller keeps a baseline
  // of what it has already announced, and "no PRs" swallowed from "no answer" makes the next good
  // read announce the entire open backlog as new.
  const { gh } = fakeGh(new Error('gh: not authenticated'))
  await assert.rejects(ghPrList('/repo', gh))
})

test('ghPrList reads the open PRs when gh answers (#1623)', async () => {
  const { gh, calls } = fakeGh(JSON.stringify([{ number: 3, title: 'a fix', url: 'u3', isDraft: false }]))
  assert.deepEqual((await ghPrList('/repo', gh)).map(pr => pr.number), [3])
  assert.ok(calls[0]!.includes('--json'))
})
