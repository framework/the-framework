import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { adoptCloudWork, startCloudWorkAdoption, CLOUD_ADOPTION_WINDOW_MS, type CloudWorkDeps, type CloudWorkResult } from './cloud-work.js'
import type { AgentMeta } from './store/index.js'
import type { LinkedPr } from './dashboard/gh.js'

// #1601: a web run's work lands on the cloud session's own `claude/*` branch, which this pass
// recognizes by ancestry from the run's hand-off anchor and records onto the run's archive.

const CWD = '/repo'
const AT = '2026-08-20T10:00:00.000Z'
const ID = '2026-08-20T10-00-00-000Z'
const NOW = Date.parse(AT) + 60 * 60 * 1000 // an hour after the run started
const ANCHOR = 'a'.repeat(40)
const HEAD_SHA = 'b'.repeat(40)

function webRun(over: Partial<AgentMeta> = {}): AgentMeta {
  return {
    id: ID,
    status: 'done',
    startedAt: AT,
    updatedAt: AT,
    target: 'web',
    branch: `tf-agent-${ID}`,
    cloudAnchor: ANCHOR,
    ...over,
  }
}

/**
 * A git runner speaking just enough of the pass's dialect: `ls-remote` answers with `heads`,
 * `cat-file -e` says every object is local, and `merge-base --is-ancestor` answers from
 * `descends` (anchor -> the head shas descending from it).
 */
function fakeGit(heads: { ref: string; sha: string }[], descends: Record<string, string[]> = { [ANCHOR]: [HEAD_SHA] }) {
  const calls: string[][] = []
  const run = async (args: string[], _cwd: string): Promise<string> => {
    calls.push([...args])
    if (args[0] === 'ls-remote') return heads.map(h => `${h.sha}\trefs/heads/${h.ref}`).join('\n')
    if (args[0] === 'cat-file') return ''
    if (args[0] === 'merge-base') {
      const [anchor, sha] = [args[2]!, args[3]!]
      if (descends[anchor]?.includes(sha)) return ''
      throw new Error('not an ancestor')
    }
    throw new Error(`unexpected git ${args.join(' ')}`)
  }
  return { calls, run }
}

interface Recorded {
  branches: { agentId: string; branch: string }[]
  prs: { agentId: string; number: number }[]
  opened: string[]
}

function deps(agents: AgentMeta[], git = fakeGit([{ ref: 'claude/fix-it', sha: HEAD_SHA }]), prs: LinkedPr[] = []) {
  const recorded: Recorded = { branches: [], prs: [], opened: [] }
  const d: CloudWorkDeps = {
    git: git.run,
    agents: async () => agents,
    prs: async () => prs,
    patch: async (_cwd, agentId, patch) => {
      if (patch.branch !== undefined) recorded.branches.push({ agentId, branch: patch.branch })
      if (patch.pr !== undefined) recorded.prs.push({ agentId, number: patch.pr.number })
      return true
    },
    openPr: async (_cwd, _agent, branch) => {
      recorded.opened.push(branch)
      return { ok: true, url: 'https://x/pull/7', number: 7 }
    },
    now: () => NOW,
  }
  return { d, recorded, git }
}

test('the head descending from the run anchor is adopted as its branch, with the PR the session opened (#1601)', async () => {
  const pr: LinkedPr = { number: 42, url: 'https://x/pull/42', state: 'OPEN', title: 't', createdAt: new Date(NOW).toISOString() }
  const { d, recorded } = deps([webRun()], fakeGit([{ ref: 'claude/fix-it', sha: HEAD_SHA }]), [pr])
  const result = await adoptCloudWork(CWD, d)
  assert.deepEqual(recorded.branches, [{ agentId: ID, branch: 'claude/fix-it' }])
  assert.deepEqual(recorded.prs, [{ agentId: ID, number: 42 }])
  assert.deepEqual(recorded.opened, [], 'the session already opened its PR, so none is opened here')
  assert.deepEqual(result.adopted, [{ agentId: ID, branch: 'claude/fix-it', pr: { number: 42, url: 'https://x/pull/42' } }])
})

test('a run armed for a PR the session never opened gets its draft PR opened and recorded (#1601)', async () => {
  const { d, recorded } = deps([webRun()])
  const result = await adoptCloudWork(CWD, d)
  assert.deepEqual(recorded.opened, ['claude/fix-it'])
  assert.deepEqual(recorded.prs, [{ agentId: ID, number: 7 }])
  assert.equal(result.adopted[0]?.opened, true)
})

test('an unarmed run gets its branch recorded and nothing opened (#1601)', async () => {
  const { d, recorded } = deps([webRun({ handoff: { push: true, pr: false } })])
  await adoptCloudWork(CWD, d)
  assert.deepEqual(recorded.branches, [{ agentId: ID, branch: 'claude/fix-it' }])
  assert.deepEqual(recorded.opened, [])
  assert.deepEqual(recorded.prs, [])
})

test('a head that is just the anchor gets no PR: the session pushed nothing beyond the hand-off (#1601)', async () => {
  const { d, recorded } = deps([webRun()], fakeGit([{ ref: 'claude/empty', sha: ANCHOR }], { [ANCHOR]: [ANCHOR] }))
  await adoptCloudWork(CWD, d)
  assert.deepEqual(recorded.branches, [{ agentId: ID, branch: 'claude/empty' }])
  assert.deepEqual(recorded.opened, [], 'a PR over nothing helps nobody')
})

test('zero or two matching heads adopt nothing: unmatched is the normal waiting state (#1601)', async () => {
  const none = deps([webRun()], fakeGit([{ ref: 'claude/other', sha: HEAD_SHA }], { [ANCHOR]: [] }))
  assert.deepEqual((await adoptCloudWork(CWD, none.d)).adopted, [])
  assert.deepEqual(none.recorded.branches, [])

  const two = deps(
    [webRun()],
    fakeGit(
      [
        { ref: 'claude/one', sha: HEAD_SHA },
        { ref: 'claude/two', sha: 'c'.repeat(40) },
      ],
      { [ANCHOR]: [HEAD_SHA, 'c'.repeat(40)] },
    ),
  )
  assert.deepEqual((await adoptCloudWork(CWD, two.d)).adopted, [], 'ancestry alone cannot arbitrate two descendants')
})

test('runs outside the pass: non-web, still running, no anchor, already adopted, too old (#1601)', async () => {
  const settled = [
    webRun({ target: 'local' }),
    webRun({ status: 'running' }),
    // No anchor recorded (the pre-hand-off push failed): nothing to match by.
    (({ cloudAnchor: _drop, ...rest }) => rest)(webRun()),
    // Adopted with its PR recorded: fully answered.
    webRun({ branch: 'claude/done', pr: { number: 1, url: 'u' } }),
    // Adopted, unarmed: the branch was the whole answer.
    webRun({ branch: 'claude/done', handoff: { push: true, pr: false } }),
    // Older than the window: no longer asked about.
    webRun({ startedAt: new Date(NOW - CLOUD_ADOPTION_WINDOW_MS - 1000).toISOString() }),
  ]
  const git = fakeGit([{ ref: 'claude/fix-it', sha: HEAD_SHA }])
  const { d, recorded } = deps(settled, git)
  await adoptCloudWork(CWD, d)
  assert.deepEqual(recorded.branches, [])
  assert.deepEqual(git.calls, [], 'nothing waiting means not even an ls-remote')
})

test('a run already adopted but still owed its armed PR keeps being asked about (#1601)', async () => {
  // The session pushed its branch but had not opened a PR when the branch was adopted; a later
  // pass finds the PR (or opens the armed draft) without re-recording the branch.
  const { d, recorded } = deps([webRun({ branch: 'claude/fix-it' })])
  await adoptCloudWork(CWD, d)
  assert.deepEqual(recorded.branches, [], 'the branch is already on the record')
  assert.deepEqual(recorded.opened, ['claude/fix-it'])
})

test('no remote, or a remote that cannot be reached, adopts nothing and never throws (#1601)', async () => {
  const git = {
    run: async (args: string[]): Promise<string> => {
      if (args[0] === 'ls-remote') throw new Error('no remote')
      throw new Error('unexpected')
    },
  }
  const { d } = deps([webRun()])
  const result = await adoptCloudWork(CWD, { ...d, git: git.run })
  assert.deepEqual(result, { adopted: [], failed: [] })
})

test('startCloudWorkAdoption says adoptions out loud and joins overlapping ticks (#1601)', async () => {
  const lines: string[] = []
  let calls = 0
  const adoption = startCloudWorkAdoption({
    projects: async () => [{ path: CWD }],
    log: line => lines.push(line),
    adopt: async (): Promise<CloudWorkResult> => {
      calls++
      return {
        adopted: [{ agentId: ID, branch: 'claude/fix-it', pr: { number: 7, url: 'https://x/pull/7' }, opened: true }],
        failed: [{ agentId: 'other', error: 'boom' }],
      }
    },
  })
  await Promise.all([adoption.tick(), adoption.tick()])
  assert.equal(calls, 1, 'overlapping ticks join the pass already running')
  assert.ok(lines.some(l => l.includes('claude/fix-it') && l.includes(ID) && l.includes('draft PR')))
  assert.ok(lines.some(l => l.includes('boom')))
  adoption.stop()
  await adoption.tick()
  assert.equal(calls, 1, 'a stopped pass runs nothing')
})

test('a PR listing that fails records the branch but opens nothing: "none" and "could not tell" must not look alike (#1601)', async () => {
  // A transient gh failure used to read as "the session opened no PR" and open a second draft on
  // a branch that already had one.
  const { d, recorded } = deps([webRun()])
  d.prs = async () => {
    throw new Error('gh: rate limited')
  }
  const result = await adoptCloudWork(CWD, d)
  assert.deepEqual(recorded.branches, [{ agentId: ID, branch: 'claude/fix-it' }], 'the branch is a fact regardless')
  assert.deepEqual(recorded.opened, [], 'no PR is opened on a listing this pass could not read')
  assert.deepEqual(recorded.prs, [])
  assert.equal(result.failed.length, 1)
  assert.match(result.failed[0]!.error, /could not list the PRs/)
})

test('a run whose record names a branch that is neither its birth branch nor the matched head is left alone (#1601)', async () => {
  // Its PR would otherwise be opened from the claude/* head and recorded against a branch it
  // does not live on.
  const { d, recorded } = deps([webRun({ branch: 'tf-renamed-by-hand' })])
  const result = await adoptCloudWork(CWD, d)
  assert.deepEqual(recorded.branches, [])
  assert.deepEqual(recorded.opened, [])
  assert.deepEqual(result.adopted, [])
})
