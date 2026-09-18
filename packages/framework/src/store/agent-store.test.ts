import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { join } from 'node:path'
import { archivedAgentPaths, findAgent, listAgents, loadAgentEvents, readAllAgents, readLiveMeta, readLiveMetas, type StoreFs } from './agent-store.js'
import { agentIdFromStartedAt, startedAtFromAgentId } from '../agent-id.js'
import { DATA_BRANCH, fileBranchPath } from '@gemstack/agent-data'

// The store reads a project's runs from two places (#1774): a run's live card and diary in its own
// checkout, written by the run's tool, and the recorded runs on the data branch.

/** An in-memory {@link StoreFs} so the store logic is tested without touching disk. */
function memFs(seed: Record<string, string> = {}): StoreFs & { files: Map<string, string> } {
  const files = new Map<string, string>(Object.entries(seed))
  return {
    files,
    async read(path) {
      const v = files.get(path)
      if (v === undefined) throw new Error(`ENOENT: ${path}`)
      return v
    },
    async write(path, contents) {
      files.set(path, contents)
    },
    async append(path, contents) {
      files.set(path, (files.get(path) ?? '') + contents)
    },
    async exists(path) {
      return files.has(path)
    },
    async mkdir() {
      // no-op: the memory fs has no directories
    },
    async readdir(dir) {
      // Derive children from the flat path map: file basenames whose dirname is `dir`, plus
      // the first segment of anything deeper (the real fs lists subdirectories too, which is
      // how `readLiveMetas` finds the per-agent worktrees).
      const prefix = dir.endsWith('/') ? dir : dir + '/'
      const names = new Set<string>()
      for (const p of files.keys()) {
        if (!p.startsWith(prefix)) continue
        const rest = p.slice(prefix.length)
        const head = rest.split('/')[0]
        if (head) names.add(head)
      }
      return [...names]
    },
    async subdirs(dir) {
      // A directory is a path segment with something under it.
      const prefix = dir.endsWith('/') ? dir : dir + '/'
      const names = new Set<string>()
      for (const p of files.keys()) {
        if (!p.startsWith(prefix)) continue
        const rest = p.slice(prefix.length)
        if (rest.includes('/')) names.add(rest.split('/')[0]!)
      }
      return [...names]
    },
  }
}

const AT = '2026-07-04T00:00:00.000Z'
const CWD = '/ws'
const USER = 'someone@example.com'

/** A file of a recorded run, on the data branch's checkout. */
const recordedAt = (id: string, ext: string, user = USER) => join(fileBranchPath(CWD, DATA_BRANCH), 'agents', user, `${id}.${ext}`)
/** A file of a run's live record, in the run's own checkout. */
const liveAt = (id: string, ext: string) => join(CWD, '.branches', `agent-${id}`, '.the-framework', `${id}.${ext}`)
const card = (id: string, status: string, more: Record<string, unknown> = {}) => JSON.stringify({ id, startedAt: AT, status, ...more })

test('listAgents lists the runs recorded on the branch, every person\'s, newest first, each card unfolded into the meta', async () => {
  const fs = memFs({
    [recordedAt('r1', 'json')]: card('r1', 'done', { intent: 'a blog', cost: 0.5, caller: { pid: 9, kind: 'build' } }),
    [recordedAt('r3', 'json', 'someone@else.com')]: card('r3', 'failed'),
    [recordedAt('r2', 'json')]: card('r2', 'waiting'),
  })
  const listed = await listAgents(CWD, fs)
  assert.deepEqual(listed.map(agent => [agent.id, agent.status]), [['r3', 'failed'], ['r2', 'waiting'], ['r1', 'done']])
  const r1 = listed.find(agent => agent.id === 'r1')!
  assert.equal(r1.intent, 'a blog')
  assert.equal(r1.cost, 0.5)
  assert.equal(r1.pid, 9, 'caller unfolds into the meta')
  assert.deepEqual(await listAgents(CWD, memFs()), [], 'a project with no data branch has no runs')
})

test('a `since` keeps the runs started at or after it (#1607)', async () => {
  const at = (iso: string) => JSON.stringify({ id: agentIdFromStartedAt(iso), startedAt: iso, status: 'done' })
  const old = agentIdFromStartedAt('2026-07-04T00:00:00.000Z')
  const recent = agentIdFromStartedAt('2026-07-06T00:00:00.000Z')
  const fs = memFs({
    [recordedAt(old, 'json')]: at('2026-07-04T00:00:00.000Z'),
    [recordedAt(recent, 'json')]: at('2026-07-06T00:00:00.000Z'),
  })
  assert.deepEqual((await listAgents(CWD, fs, Date.parse('2026-07-05T00:00:00.000Z'))).map(agent => agent.id), [recent])
})

test('readLiveMeta reads a checkout\'s card as the meta; the project root, a checkout with no card and a card that does not parse are no run', async () => {
  const fs = memFs({
    [liveAt('r1', 'json')]: card('r1', 'running', { intent: 'a blog', caller: { pid: 4242, host: 'this-box' } }),
    [liveAt('r2', 'json')]: '{"id":',
    // A card at the project root is nobody's: a run's checkout is `agent-<id>`, and the root is the person's.
    [join(CWD, '.the-framework', 'r9.json')]: card('r9', 'running'),
  })
  const meta = await readLiveMeta(join(CWD, '.branches', 'agent-r1'), fs)
  assert.equal(meta?.id, 'r1')
  assert.equal(meta?.status, 'running')
  assert.equal(meta?.pid, 4242)
  assert.equal(meta?.host, 'this-box')
  assert.equal(await readLiveMeta(join(CWD, '.branches', 'agent-r2'), fs), undefined)
  assert.equal(await readLiveMeta(join(CWD, '.branches', 'agent-r3'), fs), undefined)
  assert.equal(await readLiveMeta(CWD, fs), undefined)
})

test('readLiveMeta never ends a run whose process is gone: the tool that started it sweeps its own', async () => {
  const fs = memFs({ [liveAt('r1', 'json')]: card('r1', 'running', { caller: { pid: 2 ** 22 - 1, host: 'this-box' } }) })
  const before = fs.files.get(liveAt('r1', 'json'))
  assert.equal((await readLiveMeta(join(CWD, '.branches', 'agent-r1'), fs))?.status, 'running')
  assert.equal(fs.files.get(liveAt('r1', 'json')), before, 'a read writes nothing')
  assert.equal(fs.files.size, 1)
})

test('readLiveMetas finds the run in each checkout, newest first, a waiting one too; junk names are skipped (#738)', async () => {
  const fs = memFs({
    [liveAt('r1', 'json')]: card('r1', 'running'),
    [liveAt('r2', 'json')]: card('r2', 'waiting'),
    // Only the `agent-<id>` directories are read; anything else in there is not a run's checkout.
    [join(CWD, '.branches', '.tmp-scratch', '.the-framework', 'x.json')]: card('x', 'running'),
  })
  assert.deepEqual(
    (await readLiveMetas(CWD, fs)).map(r => ({ id: r.id, status: r.status, cwd: r.cwd })),
    [
      { id: 'r2', status: 'waiting', cwd: join(CWD, '.branches', 'agent-r2') },
      { id: 'r1', status: 'running', cwd: join(CWD, '.branches', 'agent-r1') },
    ],
  )
  assert.deepEqual(await readLiveMetas(CWD, memFs()), [])
})

test('readAllAgents and findAgent: the checkout\'s card wins over the record of the same run (#768)', async () => {
  // A resumed run has a record from its first leg and is going again in its checkout.
  const fs = memFs({
    [recordedAt('r1', 'json')]: card('r1', 'waiting'),
    [liveAt('r1', 'json')]: card('r1', 'running'),
    [recordedAt('r0', 'json')]: card('r0', 'done'),
  })
  assert.deepEqual((await readAllAgents(CWD, fs)).map(agent => [agent.id, agent.status]), [['r1', 'running'], ['r0', 'done']])
  assert.equal((await findAgent(CWD, 'r1', fs))?.status, 'running')
  assert.equal((await findAgent(CWD, 'r0', fs))?.status, 'done')
  assert.equal(await findAgent(CWD, 'nope', fs), undefined)
})

test('loadAgentEvents replays a run\'s diary as the framework\'s events: the checkout\'s while it has one, else the recorded one (#1769)', async () => {
  const recorded = ['{"kind":"said","text":"Reading."}', '{"kind":"result","text":"Done.","sessionId":"s1"}', '{"kind":"cost","usd":0.5,"turns":1}', '{"kind":"ended","status":"failed","detail":"API 500"}', ''].join('\n')
  const fs = memFs({
    [recordedAt('r1', 'json')]: card('r1', 'failed'),
    [recordedAt('r1', 'jsonl')]: recorded,
  })
  assert.deepEqual(await loadAgentEvents(CWD, 'r1', fs), [
    { kind: 'driver', event: { type: 'text', text: 'Reading.' } },
    { kind: 'driver', event: { type: 'result', text: 'Done.', sessionId: 's1' } },
    { kind: 'usage', costUsd: 0.5, turns: 1 },
    { kind: 'end', ok: false, detail: 'API 500' },
  ])

  // The same run going again: its checkout holds the newer diary, a question a turn ended on and a
  // line torn by a write in flight, which is dropped.
  fs.files.set(liveAt('r1', 'json'), card('r1', 'running'))
  fs.files.set(liveAt('r1', 'jsonl'), recorded + '{"kind":"question","title":"Which way?","options":[{"id":"a","label":"Left"}]}\n{"kind":"ended","status":"waiting"}\n{"kind":"sa')
  const live = await loadAgentEvents(CWD, 'r1', fs)
  assert.deepEqual(live?.slice(4), [
    { kind: 'choice', id: 'await-choices', title: 'Which way?', options: [{ id: 'a', label: 'Left' }] },
    { kind: 'end', ok: false, waiting: true },
  ])

  assert.equal(await loadAgentEvents(CWD, 'unknown', fs), undefined)
  assert.equal(await loadAgentEvents(CWD, '../escape', fs), undefined)
})

test('archivedAgentPaths names the recorded card and diary, and nothing for a run the branch does not have', async () => {
  const fs = memFs({ [recordedAt('r1', 'json')]: card('r1', 'done'), [recordedAt('r1', 'jsonl')]: '' })
  assert.deepEqual(await archivedAgentPaths(CWD, 'r1', fs), [recordedAt('r1', 'json'), recordedAt('r1', 'jsonl')])
  assert.deepEqual(await archivedAgentPaths(CWD, 'r2', fs), [])
  assert.deepEqual(await archivedAgentPaths(CWD, '../escape', fs), [])
})

test('startedAtFromAgentId inverts agentIdFromStartedAt, and refuses foreign ids (#1251)', () => {
  const startedAt = '2026-07-26T21:17:39.507Z'
  assert.equal(startedAtFromAgentId(agentIdFromStartedAt(startedAt)), startedAt)
  assert.equal(startedAtFromAgentId('not-a-run-id'), undefined)
  assert.equal(startedAtFromAgentId(''), undefined)
})
