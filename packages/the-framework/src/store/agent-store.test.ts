import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { join } from 'node:path'
import { hostname } from 'node:os'
import {
  AgentStore,
  applyEventToMeta,
  metaFromEvents,
  listAgents,
  readLiveMeta,
  readLiveMetas,
  archiveWorktreeAgent,
  recordAgentPr,
  restoreArchivedAgent,
  listWorktreeDirs,
  reconcileOrphanedAgents,
  loadAgentEvents,
  agentIdFromStartedAt,
  startedAtFromAgentId,
  type StoreFs,
  type AgentMeta,
} from './agent-store.js'
import type { FrameworkEvent } from '../events.js'

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
  }
}

const AT = '2026-07-04T00:00:00.000Z'
const CWD = '/ws'
const EVENTS = join(CWD, '.the-framework', 'events.jsonl')
const META = join(CWD, '.the-framework', 'agent.json')

const RUN: FrameworkEvent[] = [
  { kind: 'session', driver: 'fake', workspace: CWD, fake: true, sessionLink: 'https://claude.ai/code' },
  { kind: 'intent', text: 'a blog with comments' },
  { kind: 'session-update', sessionId: 'sess-123', sessionLink: 'https://ex.com/s/sess-123' },
  { kind: 'end', ok: true },
]

test('fresh open truncates the log and writes an initial meta snapshot', async () => {
  const fs = memFs({ [EVENTS]: 'stale\n' })
  const store = await AgentStore.open(CWD, { fs, fresh: true, now: AT })
  assert.equal(fs.files.get(EVENTS), '')
  const meta = await store.readMeta()
  assert.equal(meta?.status, 'running')
  assert.equal(meta?.startedAt, AT)
})

test('fresh open seeds the run intent into the snapshot (so prompt runs are not "(no prompt)")', async () => {
  const fs = memFs()
  const store = await AgentStore.open(CWD, { fs, fresh: true, now: AT, intent: 'what is your name' })
  assert.equal((await store.readMeta())?.intent, 'what is your name')
})

test('fresh open records an actions target so the run view can read it (#1053)', async () => {
  const fs = memFs()
  const store = await AgentStore.open(CWD, { fs, fresh: true, now: AT, target: 'actions' })
  assert.equal((await store.readMeta())?.target, 'actions')
})

test('a local target is left off the snapshot (default, #1053)', async () => {
  const fs = memFs()
  const store = await AgentStore.open(CWD, { fs, fresh: true, now: AT, target: 'local' })
  assert.equal('target' in (await store.readMeta())!, false)
})

test('an intent event still refines a seeded intent', async () => {
  const fs = memFs()
  const store = await AgentStore.open(CWD, { fs, fresh: true, now: AT, intent: 'build a blog' })
  await store.append({ kind: 'intent', text: 'a blog with comments' })
  assert.equal(store.snapshot().intent, 'a blog with comments')
})

test('append writes one JSONL line per event and derives meta', async () => {
  const fs = memFs()
  const store = await AgentStore.open(CWD, { fs, fresh: true, now: AT })
  for (const event of RUN) await store.append(event)

  const lines = (fs.files.get(EVENTS) ?? '').trim().split('\n')
  assert.equal(lines.length, RUN.length)
  assert.deepEqual(JSON.parse(lines[0]!), RUN[0])

  const meta = JSON.parse(fs.files.get(META)!) as AgentMeta
  assert.equal(meta.intent, 'a blog with comments')
  assert.equal(meta.driver, 'fake')
  assert.equal(meta.workspace, CWD)
  assert.equal(meta.sessionId, 'sess-123')
  assert.equal(meta.sessionLink, 'https://ex.com/s/sess-123')
  assert.equal(meta.status, 'done')
})

test('loadEvents round-trips the persisted log', async () => {
  const fs = memFs()
  const store = await AgentStore.open(CWD, { fs, fresh: true, now: AT })
  for (const event of RUN) await store.append(event)
  const loaded = await store.loadEvents()
  assert.deepEqual(loaded, RUN)
})

test('loadEvents skips a torn trailing line from an interrupted write', async () => {
  const good = RUN.slice(0, 2).map(e => JSON.stringify(e)).join('\n')
  const fs = memFs({ [EVENTS]: good + '\n{"kind":"log","mess' })
  const store = await AgentStore.open(CWD, { fs, fresh: false, now: AT })
  const loaded = await store.loadEvents()
  assert.equal(loaded.length, 2)
  assert.equal(loaded[1]!.kind, 'intent')
})

test('a non-fresh open preserves the existing log (resume)', async () => {
  const existing = RUN.map(e => JSON.stringify(e)).join('\n') + '\n'
  const fs = memFs({ [EVENTS]: existing })
  const store = await AgentStore.open(CWD, { fs, fresh: false, now: AT })
  assert.equal(fs.files.get(EVENTS), existing)
  assert.equal((await store.loadEvents()).length, RUN.length)
})

test('loadEvents on a never-run workspace yields an empty array', async () => {
  const store = await AgentStore.open(CWD, { fs: memFs(), fresh: false, now: AT })
  assert.deepEqual(await store.loadEvents(), [])
})

test('metaFromEvents reconstructs the same snapshot as live appends', async () => {
  const meta = metaFromEvents(RUN, AT)
  assert.equal(meta.intent, 'a blog with comments')
  assert.equal(meta.status, 'done')
  assert.equal(meta.startedAt, AT)
})

test('applyEventToMeta records the model per leg — the latest session event wins, an unrecorded one clears it (#1438)', () => {
  const base = metaFromEvents(RUN.slice(0, 3), AT)
  const first = applyEventToMeta(base, { kind: 'session', driver: 'claude', workspace: '/w', fake: false, model: 'fable' }, AT)
  assert.equal(first.model, 'fable')
  // A continuation leg may run a different model: fold, don't pin.
  const second = applyEventToMeta(first, { kind: 'session', driver: 'claude', workspace: '/w', fake: false, model: 'sonnet' }, AT)
  assert.equal(second.model, 'sonnet')
  // A leg that left the agent on its own default is unknown, not the prior leg's model.
  const bare = applyEventToMeta(second, { kind: 'session', driver: 'claude', workspace: '/w', fake: false }, AT)
  assert.equal(bare.model, undefined)
})

test('applyEventToMeta mirrors the merge arming onto the meta, so a mid-run tab can read it (#1382)', () => {
  const base = metaFromEvents(RUN.slice(0, 3), AT)
  const armed = applyEventToMeta(base, { kind: 'handoff-armed', push: true, pr: true, merge: true }, AT)
  assert.deepEqual(armed.handoff, { push: true, pr: true, merge: true })
  // A pre-#1382 event has no merge field: the mirror stays shaped like the event, not padded.
  const old = applyEventToMeta(base, { kind: 'handoff-armed', push: true, pr: false }, AT)
  assert.deepEqual(old.handoff, { push: true, pr: false })
})

test('applyEventToMeta folds the handoff report onto the meta, so list surfaces can tell publishing from done (#1455)', () => {
  const base = metaFromEvents(RUN.slice(0, 3), AT)
  assert.equal(base.handoffReport, undefined, 'no report until the epilogue speaks')
  const done = applyEventToMeta(base, { kind: 'handoff', outcome: 'done', pushed: true }, AT)
  assert.equal(done.handoffReport, 'done')
  const skipped = applyEventToMeta(base, { kind: 'handoff', outcome: 'skipped', reason: 'not-armed' }, AT)
  assert.equal(skipped.handoffReport, 'skipped')
  const failed = applyEventToMeta(base, { kind: 'handoff', outcome: 'failed', step: 'push', error: 'boom' }, AT)
  assert.equal(failed.handoffReport, 'failed')
})

test('applyEventToMeta folds the skip reason onto the meta, so the sweep can free a dead claim (#1583)', () => {
  const base = metaFromEvents(RUN.slice(0, 3), AT)
  assert.equal(base.handoffSkip, undefined)
  const skipped = applyEventToMeta(base, { kind: 'handoff', outcome: 'skipped', reason: 'no-commits' }, AT)
  assert.equal(skipped.handoffSkip, 'no-commits')
  // A handoff that ran carries no skip: the field means "why nothing happened", nothing else.
  const done = applyEventToMeta(base, { kind: 'handoff', outcome: 'done', pushed: true }, AT)
  assert.equal(done.handoffSkip, undefined)
  // And a later leg that published clears a stale skip — a resumed run's second handoff can
  // publish after its first skipped, and the release must not act on leg one's reason.
  const republished = applyEventToMeta(skipped, { kind: 'handoff', outcome: 'done', pushed: true }, AT)
  assert.equal(republished.handoffSkip, undefined)
})

test('applyEventToMeta folds the merge outcome onto the meta, so the CI watch can find its PRs (#1418)', () => {
  const base = metaFromEvents(RUN.slice(0, 3), AT)
  assert.equal(base.mergeOutcome, undefined)
  const watched = applyEventToMeta(base, { kind: 'handoff', outcome: 'done', pushed: true, merge: { outcome: 'watched' } }, AT)
  assert.equal(watched.mergeOutcome, 'watched')
  // The already-open skip carries a merge too (#1216): a rerun finding its predecessor's PR.
  const armed = applyEventToMeta(base, { kind: 'handoff', outcome: 'skipped', reason: 'already-open', merge: { outcome: 'auto-armed' } }, AT)
  assert.equal(armed.mergeOutcome, 'auto-armed')
  const noMerge = applyEventToMeta(base, { kind: 'handoff', outcome: 'done', pushed: true }, AT)
  assert.equal(noMerge.mergeOutcome, undefined, 'a handoff without a merge half folds nothing')
})

test('applyEventToMeta marks a thrown run as failed', () => {
  const base = metaFromEvents(RUN.slice(0, 3), AT)
  const failed = applyEventToMeta(base, { kind: 'end', ok: false, detail: 'boom' }, AT)
  assert.equal(failed.status, 'failed')
})

test('applyEventToMeta marks a user-stopped run as stopped, not failed (#218)', () => {
  const base = metaFromEvents(RUN.slice(0, 3), AT)
  const stopped = applyEventToMeta(base, { kind: 'end', ok: false, stopped: true }, AT)
  assert.equal(stopped.status, 'stopped')
})

test('applyEventToMeta tracks whether the run is working or parked on the user (#785)', () => {
  const base = metaFromEvents(RUN.slice(0, 3), AT)
  assert.equal(base.settledAt, undefined, 'a working run is not parked')

  const parked = applyEventToMeta(base, { kind: 'settled' }, AT)
  assert.equal(parked.settledAt, AT)
  assert.equal(parked.status, 'running', 'still live: it holds the project and takes messages')

  // The user answers: the next turn starts, so it is working again.
  const working = applyEventToMeta(parked, { kind: 'driver', event: { type: 'start', prompt: 'and dark mode' } }, AT)
  assert.equal(working.settledAt, undefined)

  // An agent that has ended is not waiting on anyone.
  const ended = applyEventToMeta(applyEventToMeta(base, { kind: 'settled' }, AT), { kind: 'end', ok: true }, AT)
  assert.equal(ended.settledAt, undefined)
  assert.equal(ended.status, 'done')
})

test('applyEventToMeta records the session name + ready-for-merge lifecycle signals (#326)', () => {
  const base = metaFromEvents(RUN.slice(0, 3), AT)
  assert.equal(base.sessionName, undefined)
  assert.equal(base.readyForMerge, undefined)
  const named = applyEventToMeta(base, { kind: 'session-name', name: 'add-comments' }, AT)
  assert.equal(named.sessionName, 'add-comments')
  const ready = applyEventToMeta(named, { kind: 'ready-for-merge' }, AT)
  assert.equal(ready.readyForMerge, true)
  assert.equal(ready.sessionName, 'add-comments') // ready doesn't clobber the name
})

test('applyEventToMeta records the ticket a run is implementing (#1117)', () => {
  const base = metaFromEvents(RUN.slice(0, 3), AT)
  assert.equal(base.ticket, undefined, 'a run nobody linked to a ticket says nothing')
  const on = applyEventToMeta(base, { kind: 'ticket', path: 'tickets/2026-07-25_login.md' }, AT)
  assert.equal(on.ticket, 'tickets/2026-07-25_login.md')
  // It is a fact about why the agent exists, so it outlives the work: a reader looking at a finished
  // run still gets to see which ticket it was.
  const ended = applyEventToMeta(on, { kind: 'end', ok: true }, AT)
  assert.equal(ended.ticket, 'tickets/2026-07-25_login.md')
})

test('applyEventToMeta tracks the pending choice gate a run is parked on (#636)', () => {
  const base = metaFromEvents(RUN.slice(0, 3), AT)
  assert.equal(base.pendingChoice, undefined)
  const asked = applyEventToMeta(base, { kind: 'choice', id: 'g1', title: 'Cache the auth store?', options: [{ id: 'y', label: 'Yes' }] }, AT)
  assert.deepEqual(asked.pendingChoice, { id: 'g1', title: 'Cache the auth store?' })
  // A resolve for a different gate id leaves it parked; the matching resolve clears it.
  const other = applyEventToMeta(asked, { kind: 'choice-resolved', id: 'other', picked: 'y', by: 'user' }, AT)
  assert.deepEqual(other.pendingChoice, { id: 'g1', title: 'Cache the auth store?' })
  const resolved = applyEventToMeta(asked, { kind: 'choice-resolved', id: 'g1', picked: 'y', by: 'user' }, AT)
  assert.equal(resolved.pendingChoice, undefined)
})

test('applyEventToMeta clears a pending choice when the run ends (#636)', () => {
  const base = metaFromEvents(RUN.slice(0, 3), AT)
  const asked = applyEventToMeta(base, { kind: 'choice', id: 'g1', title: 'q?', options: [{ id: 'y', label: 'Yes' }] }, AT)
  const ended = applyEventToMeta(asked, { kind: 'end', ok: true }, AT)
  assert.equal(ended.pendingChoice, undefined)
})

test('close archives the run into runs/<id>.json + .jsonl for history (#303)', async () => {
  const fs = memFs()
  const store = await AgentStore.open(CWD, { fs, fresh: true, now: AT })
  for (const event of RUN) await store.append(event)
  await store.close()

  const id = store.snapshot().id
  const archivedMeta = fs.files.get(join(CWD, '.the-framework', 'agents', `${id}.json`))
  const archivedLog = fs.files.get(join(CWD, '.the-framework', 'agents', `${id}.jsonl`))
  assert.ok(archivedMeta, 'meta archived')
  assert.ok(archivedLog, 'log archived')
  assert.equal((JSON.parse(archivedMeta!) as AgentMeta).intent, 'a blog with comments')
  assert.equal(archivedLog!.trim().split('\n').length, RUN.length)
})

test('listAgents returns archived runs newest-first with intent + status (#303)', async () => {
  const fs = memFs()
  const a = await AgentStore.open(CWD, { fs, fresh: true, now: '2026-07-04T00:00:00.000Z' })
  for (const e of RUN) await a.append(e)
  await a.close()
  const b = await AgentStore.open(CWD, { fs, fresh: true, now: '2026-07-05T00:00:00.000Z' })
  await b.append({ kind: 'intent', text: 'a todo app' })
  await b.close()

  const agents = await listAgents(CWD, fs)
  assert.equal(agents.length, 2)
  assert.equal(agents[0]!.intent, 'a todo app') // newest first
  assert.equal(agents[1]!.intent, 'a blog with comments')
  assert.equal(agents[1]!.status, 'done')
  assert.equal(agents[1]!.sessionLink, 'https://ex.com/s/sess-123')
})

test('readLiveMeta reads the in-progress agent.json with a running status (before close)', async () => {
  const fs = memFs()
  const store = await AgentStore.open(CWD, { fs, fresh: true, now: AT })
  for (const e of RUN.slice(0, -1)) await store.append(e) // every event but the terminal `end`
  // No close(): the agent is still live. Its meta reads back as running with the intent.
  const live = await readLiveMeta(CWD, fs)
  assert.ok(live, 'live meta present')
  assert.equal(live!.status, 'running')
  assert.equal(live!.intent, 'a blog with comments')
  assert.equal(live!.id, store.snapshot().id)
})

test('readLiveMeta yields undefined on a never-run workspace', async () => {
  assert.equal(await readLiveMeta(CWD, memFs()), undefined)
})

test('readLiveMeta re-reads a torn agent.json rather than reporting the run gone (#1540)', async () => {
  const fs = memFs()
  const store = await AgentStore.open(CWD, { fs, fresh: true, now: AT })
  for (const e of RUN.slice(0, -1)) await store.append(e)
  const settled = fs.files.get(META)!
  // The agent's own process rewrites its meta in place while every other reader polls it, so a
  // read can land between that write's truncate and its bytes. The first read here sees the
  // half-written file the way a real reader would; the write lands before the retry.
  fs.files.set(META, settled.slice(0, 20))
  let reads = 0
  const tearing: StoreFs = {
    ...fs,
    async read(path) {
      const raw = await fs.read(path)
      if (path === META && ++reads === 1) return raw
      if (path === META) fs.files.set(META, settled)
      return path === META ? settled : raw
    },
  }
  const live = await readLiveMeta(CWD, tearing)
  assert.ok(live, 'the run is still there — a torn read is not an absent run')
  assert.equal(live!.status, 'running')
  assert.ok(reads > 1, 'the unparseable read was retried')
})

test('readLiveMeta gives up on an agent.json that is corrupt for good', async () => {
  const fs = memFs({ [META]: '{ this was never json' })
  assert.equal(await readLiveMeta(CWD, fs), undefined)
})

test('the meta is read under one name: a pre-D5 run.json is not an agent', async () => {
  // D5 renamed the meta to agent.json, and nothing reads the name it had before. Zero users, so a
  // leftover run.json is a file from another product — the alternative is a second name every read
  // site has to try, forever, to rescue a checkout nobody has.
  const seeded = memFs()
  const store = await AgentStore.open(CWD, { fs: seeded, fresh: true, now: AT })
  for (const e of RUN.slice(0, -1)) await store.append(e)
  const fs = memFs({
    [join(CWD, '.the-framework', 'run.json')]: seeded.files.get(META)!,
    [EVENTS]: seeded.files.get(EVENTS)!,
  })

  assert.equal(await readLiveMeta(CWD, fs), undefined)
})

test('agent.json is renamed into place, never truncated where a reader can see it (#1540)', async () => {
  const fs = memFs()
  const written: string[] = []
  const renamed: Array<[string, string]> = []
  const atomic: StoreFs = {
    ...fs,
    async write(path, contents) {
      written.push(path)
      return fs.write(path, contents)
    },
    async rename(from, to) {
      renamed.push([from, to])
      fs.files.set(to, fs.files.get(from)!)
      fs.files.delete(from)
    },
  }
  const store = await AgentStore.open(CWD, { fs: atomic, fresh: true, now: AT })
  for (const e of RUN) await store.append(e)
  await store.close()

  // The invariant a concurrent reader depends on: the live meta's own path is never opened for
  // writing, so it is never the empty file a truncate leaves behind. It only ever appears as a
  // rename target, which swaps the whole file in one step.
  assert.equal(
    written.filter(path => path === META).length,
    0,
    `agent.json was written in place: ${written.filter(path => path === META).length} time(s)`,
  )
  assert.ok(
    renamed.some(([, to]) => to === META),
    'the live meta was renamed into place',
  )
  // Every meta write, the archived copies included, goes scratch-then-rename; nothing is ever
  // handed a path it then truncates.
  assert.ok(
    renamed.every(([from, to]) => from.startsWith(`${to}.`) && from.endsWith('.tmp')),
    `a rename came from something other than that path's scratch file: ${JSON.stringify(renamed)}`,
  )
  assert.deepEqual(
    written.filter(path => !path.endsWith('.tmp') && path.endsWith('.json')),
    [],
    'no meta path is opened for writing',
  )
  assert.equal(fs.files.has(META), true, 'and the meta is there afterwards')
  assert.ok(
    ![...fs.files.keys()].some(path => path.endsWith('.tmp')),
    'no scratch file is left behind',
  )
})

test('a store whose fs cannot rename still writes its meta in place', async () => {
  const fs = memFs()
  assert.equal(fs.rename, undefined)
  const store = await AgentStore.open(CWD, { fs, fresh: true, now: AT })
  for (const e of RUN) await store.append(e)
  const live = await readLiveMeta(CWD, fs)
  assert.equal(live!.intent, 'a blog with comments')
})

test('loadAgentEvents replays an archived run, and rejects unknown/unsafe ids (#303)', async () => {
  const fs = memFs()
  const store = await AgentStore.open(CWD, { fs, fresh: true, now: AT })
  for (const e of RUN) await store.append(e)
  await store.close()
  const id = store.snapshot().id

  assert.deepEqual(await loadAgentEvents(CWD, id, fs), RUN)
  assert.equal(await loadAgentEvents(CWD, 'nope', fs), undefined)
  assert.equal(await loadAgentEvents(CWD, '../escape', fs), undefined)
})

test('a fresh run archives a prior run that never got closed (crash safety) (#303)', async () => {
  const fs = memFs()
  const crashed = await AgentStore.open(CWD, { fs, fresh: true, now: '2026-07-04T00:00:00.000Z' })
  for (const e of RUN) await crashed.append(e)
  // no close() — simulate a crash. Now a new agent opens fresh over the live files.
  await AgentStore.open(CWD, { fs, fresh: true, now: '2026-07-05T00:00:00.000Z' })

  const agents = await listAgents(CWD, fs)
  assert.equal(agents.length, 1)
  assert.equal(agents[0]!.intent, 'a blog with comments')
})

const RUNS = join(CWD, '.the-framework', 'agents')
const runningAgentMeta = (id: string): string =>
  JSON.stringify({ status: 'running', id, startedAt: AT, updatedAt: AT })

test('listAgents reads every user archive and the transient one, under their one name (#1179)', async () => {
  // Both live locations are listed — the committed per-user archive and the transient one an agent
  // with no worktree writes into. The names those directories had before D5 (`sessions/`, `runs/`)
  // are not read: a second spelling per location is four directory probes per listing to find
  // archives that, with no users, nobody has.
  const meta = (id: string): string =>
    JSON.stringify({ status: 'done', id, startedAt: AT, updatedAt: AT, intent: id })
  const user = join(CWD, '.the-framework', 'branches', 'tf-data', 'agents', 'dev@example.com')
  const fs = memFs({
    [join(user, '2026-new.json')]: meta('2026-new'),
    [join(CWD, '.the-framework', 'agents', '2026-transient.json')]: meta('2026-transient'),
    [join(CWD, '.the-framework', 'dev@example.com', 'agents', '2026-old.json')]: meta('2026-old'),
    [join(CWD, '.the-framework', 'runs', '2026-ancient.json')]: meta('2026-ancient'),
  })
  const agents = await listAgents(CWD, fs)
  assert.deepEqual(agents.map(r => r.id).sort(), ['2026-new', '2026-transient'])
})

test('reconcileOrphanedAgents flips archived runs stuck at running to stopped (#642)', async () => {
  const fs = memFs({
    [join(RUNS, 'a.json')]: runningAgentMeta('a'),
    [join(RUNS, 'b.json')]: runningAgentMeta('b'),
    [join(RUNS, 'c.json')]: JSON.stringify({ status: 'done', id: 'c', startedAt: AT, updatedAt: AT }),
  })
  const fixed = await reconcileOrphanedAgents(CWD, fs)
  assert.equal(fixed, 2)
  const agents = await listAgents(CWD, fs)
  assert.deepEqual(agents.map(r => [r.id, r.status]).sort(), [['a', 'stopped'], ['b', 'stopped'], ['c', 'done']])
})

test('reconcileOrphanedAgents flips a live run and archives it, counting it once (#642)', async () => {
  const fs = memFs({ [META]: runningAgentMeta('2026-live') })
  const fixed = await reconcileOrphanedAgents(CWD, fs)
  assert.equal(fixed, 1)
  // The live agent.json is now stopped...
  assert.equal((await readLiveMeta(CWD, fs))!.status, 'stopped')
  // ...and archived (as stopped) so it stays in the history list.
  const agents = await listAgents(CWD, fs)
  assert.deepEqual(agents.map(r => [r.id, r.status]), [['2026-live', 'stopped']])
})

// #926: it used to flip every `running` meta, on the assumption that a fresh daemon drives no
// in-flight run. A second daemon boot then marked genuinely live agents as finished.
test('reconcileOrphanedAgents leaves a run whose pid is alive on this host (#926)', async () => {
  const owned = (id: string, over: Record<string, unknown> = {}): string =>
    JSON.stringify({ status: 'running', id, startedAt: AT, updatedAt: AT, pid: 42, host: hostname(), ...over })
  const fs = memFs({
    [META]: owned('live'),
    [join(RUNS, 'alive.json')]: owned('alive'),
    [join(RUNS, 'dead.json')]: owned('dead', { pid: 43 }),
    [join(RUNS, 'elsewhere.json')]: owned('elsewhere', { host: 'another-machine' }),
    ...worktreeFiles('wt', JSON.parse(owned('wt')) as Record<string, unknown>),
  })
  // Only pid 42 is running; 43 is gone, and a pid on another host is unknowable so it is flipped.
  const fixed = await reconcileOrphanedAgents(CWD, fs, pid => pid === 42)
  assert.equal(fixed, 2, 'only the two that are not provably alive')
  // Read the files, not `readLiveMeta`/`listAgents`: those run their own #716 probe against the
  // real process table, and pid 42 is not alive here.
  const statusOf = (path: string): string => (JSON.parse(fs.files.get(path)!) as AgentMeta).status
  assert.equal(statusOf(META), 'running', 'the live run is still running')
  assert.equal(statusOf(join(worktreeAt('wt'), '.the-framework', 'agent.json')), 'running', 'and so is the one in a worktree')
  assert.equal(statusOf(join(RUNS, 'alive.json')), 'running')
  assert.equal(statusOf(join(RUNS, 'dead.json')), 'stopped')
  assert.equal(statusOf(join(RUNS, 'elsewhere.json')), 'stopped', 'a pid on another host is unknowable, so it is still flipped')
})

test('reconcileOrphanedAgents is a no-op on a clean or empty workspace (#642)', async () => {
  assert.equal(await reconcileOrphanedAgents(CWD, memFs()), 0)
  const done = memFs({ [META]: JSON.stringify({ status: 'done', id: 'd', startedAt: AT, updatedAt: AT }) })
  assert.equal(await reconcileOrphanedAgents(CWD, done), 0)
})

// #716: an agent whose process dies without writing `end`. The owning pid+host are persisted so a
// reader can flip it to `stopped` (and archive it) without waiting for a daemon-restart reconcile.
const HERE = hostname()
const ownedMeta = (id: string, pid: number, host: string): string =>
  JSON.stringify({ status: 'running', id, startedAt: AT, updatedAt: AT, pid, host })

test('a fresh open records the owning pid + host so a dead run can be detected (#716)', async () => {
  const fs = memFs()
  await AgentStore.open(CWD, { fs, fresh: true, now: AT, owner: { pid: 4242, host: 'box-a' } })
  const meta = JSON.parse(fs.files.get(META)!) as AgentMeta
  assert.equal(meta.pid, 4242)
  assert.equal(meta.host, 'box-a')
})

test('readLiveMeta self-heals a running run whose owning process is gone: stopped + archived (#716)', async () => {
  const fs = memFs({ [META]: ownedMeta('2026-dead', 999999, HERE) })
  const live = await readLiveMeta(CWD, fs, () => false) // pid probe says the owner is gone
  assert.equal(live!.status, 'stopped')
  // The on-disk agent.json is flipped, and the agent is archived (as stopped) so it stays in history.
  assert.equal((JSON.parse(fs.files.get(META)!) as AgentMeta).status, 'stopped')
  const agents = await listAgents(CWD, fs)
  assert.deepEqual(agents.map(r => [r.id, r.status]), [['2026-dead', 'stopped']])
})

test('readLiveMeta leaves a running run alone while its owning process is alive (#716)', async () => {
  const fs = memFs({ [META]: ownedMeta('2026-live', process.pid, HERE) })
  const live = await readLiveMeta(CWD, fs, () => true)
  assert.equal(live!.status, 'running')
  assert.equal((JSON.parse(fs.files.get(META)!) as AgentMeta).status, 'running')
})

test('readLiveMeta leaves a pre-pid run untouched — the boot reconcile still catches it (#716)', async () => {
  const fs = memFs({ [META]: runningAgentMeta('2026-old') }) // no pid recorded
  const live = await readLiveMeta(CWD, fs, () => false)
  assert.equal(live!.status, 'running')
})

test('readLiveMeta does not trust a pid from a different host (#716)', async () => {
  const fs = memFs({ [META]: ownedMeta('2026-remote', 4242, 'other-box') })
  const live = await readLiveMeta(CWD, fs, () => false)
  assert.equal(live!.status, 'running') // a dead-looking pid on another host is unknowable here
})

test('fresh open adopts the id the daemon allocated, ignoring an unsafe one (#736)', async () => {
  // The daemon names the agent's worktree with the id before spawning it, so the agent must
  // record that id rather than derive a second one from its own start time.
  const adopted = await AgentStore.open(CWD, { fs: memFs(), fresh: true, now: AT, id: 'run-42' })
  assert.equal((await adopted.readMeta())?.id, 'run-42')

  // A traversal-shaped id is dropped for the derived one: the id names a directory.
  const unsafe = await AgentStore.open(CWD, { fs: memFs(), fresh: true, now: AT, id: '../evil' })
  assert.equal((await unsafe.readMeta())?.id, agentIdFromStartedAt(AT))
})

// #738: since #736 an agent lives in its own worktree, so a project's live agents are spread across
// `.the-framework/branches/*` rather than sitting at the project path.
const worktreeMeta = (agentId: string, over: Partial<AgentMeta> = {}): string =>
  JSON.stringify({ version: 1, status: 'running', id: agentId, startedAt: AT, updatedAt: AT, ...over })

test('readLiveMetas finds a run living in each worktree, newest first (#738)', async () => {
  const fs = memFs({
    [join(CWD, '.the-framework', 'branches', 'tf-agent-r1', '.the-framework', 'agent.json')]: worktreeMeta('r1'),
    [join(CWD, '.the-framework', 'branches', 'tf-agent-r2', '.the-framework', 'agent.json')]: worktreeMeta('r2'),
  })
  const agents = await readLiveMetas(CWD, fs)
  assert.deepEqual(
    agents.map(r => ({ id: r.id, cwd: r.cwd })),
    [
      { id: 'r2', cwd: join(CWD, '.the-framework', 'branches', 'tf-agent-r2') },
      { id: 'r1', cwd: join(CWD, '.the-framework', 'branches', 'tf-agent-r1') },
    ],
    'both runs, newest id first, each carrying its own checkout',
  )
})

test('readLiveMetas also returns a run at the project root (the non-git fallback, and pre-#736 runs)', async () => {
  const fs = memFs({
    [META]: worktreeMeta('root-run'),
    [join(CWD, '.the-framework', 'branches', 'tf-agent-r1', '.the-framework', 'agent.json')]: worktreeMeta('r1'),
  })
  const agents = await readLiveMetas(CWD, fs)
  assert.deepEqual(agents.map(r => r.id).sort(), ['r1', 'root-run'])
  assert.equal(agents.find(r => r.id === 'root-run')?.cwd, CWD, 'the root run reports the repo itself')
})

test('readLiveMetas is empty on a project that never ran, and skips a junk worktree name', async () => {
  assert.deepEqual(await readLiveMetas(CWD, memFs()), [])
  // Only our own `<agentId>` directories are read; anything else in there is not an agent of ours.
  const fs = memFs({
    [join(CWD, '.the-framework', 'branches', '.tmp-scratch', '.the-framework', 'agent.json')]: worktreeMeta('x'),
  })
  assert.deepEqual(await readLiveMetas(CWD, fs), [])
})

test('readLiveMetas self-heals a dead run in a worktree, same as the single reader (#716)', async () => {
  const path = join(CWD, '.the-framework', 'branches', 'tf-agent-r1', '.the-framework', 'agent.json')
  const fs = memFs({ [path]: worktreeMeta('r1', { pid: 999999, host: hostname() }) })
  const agents = await readLiveMetas(CWD, fs, () => false)
  assert.equal(agents[0]?.status, 'stopped', 'a running meta whose process is gone reads as stopped')
  assert.equal((JSON.parse(fs.files.get(path)!) as AgentMeta).status, 'stopped', 'and is healed on disk')
})

// #737: an agent's history lives inside its worktree, so removing that worktree would delete the agent
// from the dashboard's history. It is copied into the repo first, which is what makes teardown safe.
const worktreeAt = (agentId: string) => join(CWD, '.the-framework', 'branches', `tf-agent-${agentId}`)
const worktreeFiles = (agentId: string, meta: Record<string, unknown>, events = '') => ({
  [join(worktreeAt(agentId), '.the-framework', 'agent.json')]: JSON.stringify(meta),
  [join(worktreeAt(agentId), '.the-framework', 'events.jsonl')]: events,
})

test('archiveWorktreeAgent copies a finished run into the repo history (#737)', async () => {
  const fs = memFs(worktreeFiles('r1', { version: 1, status: 'done', id: 'r1', startedAt: AT, updatedAt: AT }, '{"kind":"log","message":"hi"}\n'))
  const meta = await archiveWorktreeAgent(worktreeAt('r1'), CWD, fs)
  assert.equal(meta?.status, 'done')
  assert.equal(fs.files.get(join(CWD, '.the-framework', 'agents', 'r1.jsonl')), '{"kind":"log","message":"hi"}\n', 'the log lands in the repo')
  // And the archived copy is what listAgents reads, so the agent survives losing its worktree.
  assert.deepEqual((await listAgents(CWD, fs)).map(r => r.id), ['r1'])
})

test('archiveWorktreeAgent records a run that died mid-flight as stopped, not running (#737)', async () => {
  const fs = memFs(worktreeFiles('r1', { version: 1, status: 'running', id: 'r1', startedAt: AT, updatedAt: AT }))
  // The process is gone by the time we archive, so `running` here means it never closed.
  assert.equal((await archiveWorktreeAgent(worktreeAt('r1'), CWD, fs))?.status, 'stopped')
  assert.equal((JSON.parse(fs.files.get(join(CWD, '.the-framework', 'agents', 'r1.json'))!) as AgentMeta).status, 'stopped')
})

test('recordAgentPr patches the archived meta, so a PR opened after the run still lands on it (E6)', async () => {
  // The dashboard's Open PR button runs after the session's process is gone, so there is no event
  // stream left to carry the fact — but it is the same fact, and every surface reads it from the
  // same place either way.
  const fs = memFs(worktreeFiles('r1', { version: 1, status: 'done', id: 'r1', startedAt: AT, updatedAt: AT }))
  await archiveWorktreeAgent(worktreeAt('r1'), CWD, fs)
  assert.equal(await recordAgentPr(CWD, 'r1', { number: 42, url: 'https://x/pull/42' }, fs), true)
  assert.deepEqual((await listAgents(CWD, fs)).find(r => r.id === 'r1')?.pr, { number: 42, url: 'https://x/pull/42' })
})

test('recordAgentPr leaves the record as it was when there is nothing to patch (E6)', async () => {
  // Best-effort: the cost of missing it is one surface having to ask gh, which is what all of them
  // used to do anyway.
  const fs = memFs()
  assert.equal(await recordAgentPr(CWD, 'nope', { number: 1, url: 'u' }, fs), false)
  assert.equal(await recordAgentPr(CWD, '../escape', { number: 1, url: 'u' }, fs), false, 'and an unsafe id is refused')
})

test('archiveWorktreeAgent is forgiving of a worktree with no run', async () => {
  assert.equal(await archiveWorktreeAgent(worktreeAt('nope'), CWD, memFs()), undefined)
})

const USER = 'git@brillout.com'
const archiveAt = (id: string, ext: string) =>
  join(CWD, '.the-framework', 'branches', 'tf-data', 'agents', USER, `${id}.${ext}`)

test('a named user files the archive under their own sessions, not runs/ (#1179)', async () => {
  // The whole point: `agents/` is gitignored, so a `git clean -fdx` took every session with it.
  const fs = memFs(worktreeFiles('r1', { version: 1, status: 'done', id: 'r1', startedAt: AT, updatedAt: AT }, '{"kind":"log","message":"hi"}\n'))
  await archiveWorktreeAgent(worktreeAt('r1'), CWD, fs, undefined, USER)
  assert.equal(fs.files.get(archiveAt('r1', 'jsonl')), '{"kind":"log","message":"hi"}\n')
  assert.equal(fs.files.has(join(CWD, '.the-framework', 'agents', 'r1.json')), false, 'and not in the transient dir')
})

test('the history lists every user, and the runs archived before this shipped (#1179)', async () => {
  // Both schemes coexist: `agents/` holds everything from before, and a teammate's directory is as
  // much a part of the project's history as your own — that is what committing it is for.
  const done = (id: string) => JSON.stringify({ version: 1, status: 'done', id, startedAt: AT, updatedAt: AT })
  const fs = memFs({
    [join(CWD, '.the-framework', 'agents', 'r1.json')]: done('r1'),
    [archiveAt('r2', 'json')]: done('r2'),
    [join(CWD, '.the-framework', 'branches', 'tf-data', 'agents', 'someone@else.com', 'r3.json')]: done('r3'),
  })
  assert.deepEqual((await listAgents(CWD, fs)).map(agent => agent.id), ['r3', 'r2', 'r1'])
})

test('a run archived under both schemes is listed once (#1179)', async () => {
  // An agent archived before #1179 and re-archived after exists in both places; the history is a list
  // of sessions, not of files.
  const meta = JSON.stringify({ version: 1, status: 'done', id: 'r1', startedAt: AT, updatedAt: AT })
  const fs = memFs({ [join(CWD, '.the-framework', 'agents', 'r1.json')]: meta, [archiveAt('r1', 'json')]: meta })
  assert.deepEqual((await listAgents(CWD, fs)).map(agent => agent.id), ['r1'])
})

test('an archived log replays wherever it is filed (#1179)', async () => {
  // The id alone no longer names a path, so every reader has to look the agent up.
  const fs = memFs({
    [archiveAt('r1', 'json')]: JSON.stringify({ version: 1, status: 'done', id: 'r1', startedAt: AT, updatedAt: AT }),
    [archiveAt('r1', 'jsonl')]: '{"kind":"log","message":"replayed"}\n',
  })
  assert.deepEqual(await loadAgentEvents(CWD, 'r1', fs), [{ kind: 'log', message: 'replayed' }])
})

test('a committed session stuck at running is reconciled too (#1179)', async () => {
  // The boot reconcile used to sweep only `agents/`, so a crashed agent archived under a user would
  // have shown as live forever, with a Stop that does nothing.
  const fs = memFs({
    [archiveAt('r1', 'json')]: JSON.stringify({ version: 1, status: 'running', id: 'r1', startedAt: AT, updatedAt: AT }),
  })
  assert.equal(await reconcileOrphanedAgents(CWD, fs, () => false), 1)
  assert.equal((JSON.parse(fs.files.get(archiveAt('r1', 'json'))!) as AgentMeta).status, 'stopped')
})

test('reconcileOrphanedAgents rescues a run a crashed daemon left in a worktree (#737)', async () => {
  const fs = memFs(worktreeFiles('r1', { version: 1, status: 'running', id: 'r1', startedAt: AT, updatedAt: AT }))
  assert.equal(await reconcileOrphanedAgents(CWD, fs), 1)
  assert.equal(
    (JSON.parse(fs.files.get(join(worktreeAt('r1'), '.the-framework', 'agent.json'))!) as AgentMeta).status,
    'stopped',
    'the live meta stops claiming to be running',
  )
  assert.equal(
    (JSON.parse(fs.files.get(join(CWD, '.the-framework', 'agents', 'r1.json'))!) as AgentMeta).status,
    'stopped',
    'and its history is rescued into the repo',
  )
})

test('listWorktreeDirs names the run of each worktree, ignoring anything else in there', async () => {
  const fs = memFs({
    ...worktreeFiles('r1', { id: 'r1' }),
    ...worktreeFiles('r2', { id: 'r2' }),
    [join(CWD, '.the-framework', 'branches', '.tmp', 'x')]: '',
  })
  assert.deepEqual((await listWorktreeDirs(CWD, fs)).sort(), ['r1', 'r2'])
  assert.deepEqual(await listWorktreeDirs(join(CWD, 'never-ran'), fs), [])
})

test('listWorktreeDirs never mistakes a rename link for a run (#1580)', async () => {
  const fs = memFs({
    ...worktreeFiles('r1', { id: 'r1' }),
    // A rename link beside the checkouts: its name has no run prefix, so it is not a run.
    [join(CWD, '.the-framework', 'branches', 'tf-cool-name')]: 'tf-agent-r1',
  })
  assert.deepEqual(await listWorktreeDirs(CWD, fs), ['r1'])
})

// #762: messaging a stopped agent continues THAT run, so the history shows one row rather than an
// unrelated-looking second one. The follow-up is still a separate process; what makes it one agent is
// that it reopens the same log instead of truncating it.
test('continueAgent reopens the existing run: same id, same log, running again (#762)', async () => {
  const fs = memFs({
    [META]: JSON.stringify({ version: 1, status: 'stopped', id: 'r1', startedAt: AT, updatedAt: AT, intent: 'build a blog' }),
    [EVENTS]: '{"kind":"log","message":"first leg"}\n',
  })
  const store = await AgentStore.open(CWD, { fs, continueAgent: true, now: '2026-07-04T01:00:00.000Z' })
  const meta = await store.readMeta()
  assert.equal(meta?.id, 'r1', 'the same run, so the rail shows one row')
  assert.equal(meta?.status, 'running', 'live again')
  assert.equal(meta?.intent, 'build a blog', 'and keeps what it was originally asked to do')
  assert.equal(fs.files.get(EVENTS), '{"kind":"log","message":"first leg"}\n', 'the earlier output survives')

  // The continuing process owns it now, so a liveness probe reads it as alive, not orphaned (#716).
  assert.equal(meta?.pid, process.pid)

  await store.append({ kind: 'log', message: 'second leg' })
  assert.match(fs.files.get(EVENTS)!, /first leg[\s\S]*second leg/, 'the second leg appends to the same log')
})

test('continueAgent with nothing to reopen falls back to a fresh run (#762)', async () => {
  const store = await AgentStore.open(CWD, { fs: memFs(), continueAgent: true, fresh: true, now: AT, id: 'r9' })
  assert.equal((await store.readMeta())?.id, 'r9')
  assert.equal((await store.readMeta())?.status, 'running')
})

test('restoreArchivedAgent puts a torn-down run history back in its worktree (#762)', async () => {
  // #737 moved the history to the repo and removed the checkout; continuing needs it back.
  const fs = memFs({
    [join(CWD, '.the-framework', 'agents', 'r1.json')]: JSON.stringify({ version: 1, status: 'done', id: 'r1', startedAt: AT, updatedAt: AT }),
    [join(CWD, '.the-framework', 'agents', 'r1.jsonl')]: '{"kind":"log","message":"archived"}\n',
  })
  const wt = join(CWD, '.the-framework', 'branches', 'tf-agent-r1')
  assert.equal(await restoreArchivedAgent(CWD, wt, 'r1', fs), true)
  assert.equal(fs.files.get(join(wt, '.the-framework', 'events.jsonl')), '{"kind":"log","message":"archived"}\n')
  assert.equal((JSON.parse(fs.files.get(join(wt, '.the-framework', 'agent.json'))!) as AgentMeta).id, 'r1')

  // Idempotent: a checkout that already holds a live agent keeps it (its log is the newer one).
  assert.equal(await restoreArchivedAgent(CWD, wt, 'r1', fs), false)
  // Nothing archived, nothing to do.
  assert.equal(await restoreArchivedAgent(CWD, join(CWD, 'nope'), 'r404', memFs()), false)
})

test('updatedAt tracks the last event, not the run start (settledAt likewise)', async () => {
  // The regression: the open timestamp was reused for every append, so an agent that had been going
  // for hours still reported updatedAt === startedAt. Everything that orders by recency — the
  // overview's active runs, the activity feed, the interventions queue — sorted on that.
  const ticks = ['2026-01-01T00:00:10.000Z', '2026-01-01T00:00:20.000Z']
  let tick = 0
  const store = await AgentStore.open('/w', {
    fs: memFs(),
    fresh: true,
    now: AT,
    clock: () => ticks[Math.min(tick++, ticks.length - 1)]!,
  })

  assert.equal(store.snapshot().startedAt, AT)
  assert.equal(store.snapshot().updatedAt, AT, 'nothing appended yet')

  await store.append({ kind: 'log', message: 'first' })
  assert.equal(store.snapshot().updatedAt, ticks[0])

  await store.append({ kind: 'log', message: 'second' })
  assert.equal(store.snapshot().updatedAt, ticks[1], 'each event advances it')
  assert.equal(store.snapshot().startedAt, AT, 'the start is still the start')
})

test('startedAtFromAgentId inverts agentIdFromStartedAt, and refuses foreign ids (#1251)', () => {
  const startedAt = '2026-07-26T21:17:39.507Z'
  assert.equal(startedAtFromAgentId(agentIdFromStartedAt(startedAt)), startedAt)
  assert.equal(startedAtFromAgentId('not-a-run-id'), undefined)
  assert.equal(startedAtFromAgentId(''), undefined)
})

test('applyEventToMeta records the pull request a session opened (E6)', () => {
  // The number is a fact about the agent, so the agent writes it down — rather than every later
  // surface re-deriving it from branch names and creation times.
  const base = metaFromEvents(RUN.slice(0, 3), AT)
  assert.equal(base.pr, undefined, 'a session with no PR says nothing')
  const on = applyEventToMeta(base, { kind: 'pull-request', number: 42, url: 'https://x/pull/42' }, AT)
  assert.deepEqual(on.pr, { number: 42, url: 'https://x/pull/42' })
  // It must outlive the agent: every read of it happens after the session has ended.
  assert.deepEqual(applyEventToMeta(on, { kind: 'end', ok: true }, AT).pr, { number: 42, url: 'https://x/pull/42' })
})

test('applyEventToMeta records the branch a branch event names (#1277)', () => {
  const base = metaFromEvents(RUN.slice(0, 3), AT)
  const on = applyEventToMeta(base, { kind: 'branch', branch: 'tf-agent-r1' }, AT)
  assert.equal(on.branch, 'tf-agent-r1')
  // A rename mid-run replaces it: the meta always names the branch the work is on now.
  const renamed = applyEventToMeta(on, { kind: 'branch', branch: 'tf-cool-name' }, AT)
  assert.equal(renamed.branch, 'tf-cool-name')
})

// #1359: an agent that dies holding an open gate. The process exited without writing `end` (the
// empty-event-loop death), so every flip of a dead `running` run must write the ending on its
// behalf: an `end` event in the log (what expires the dashboard's question) and a meta without
// the pendingChoice (what clears the "needs you" surfaces).
const CHOICE_LINE = '{"kind":"choice","id":"todo-next","title":"Start the next backlog item?","options":[{"id":"proceed","label":"Go"},{"id":"stop","label":"Stop"}]}\n'
const deadGatedMeta = (id: string): string =>
  JSON.stringify({
    status: 'running',
    id,
    startedAt: AT,
    updatedAt: AT,
    pid: 999999,
    host: HERE,
    pendingChoice: { id: 'todo-next', title: 'Start the next backlog item?' },
  })
const lastEvent = (jsonl: string): Record<string, unknown> => {
  const lines = jsonl.trim().split('\n')
  return JSON.parse(lines[lines.length - 1]!) as Record<string, unknown>
}

test('readLiveMeta writes the end a dead run never did: log + meta + archive (#1359)', async () => {
  const fs = memFs({ [META]: deadGatedMeta('2026-gated'), [EVENTS]: CHOICE_LINE })
  const healed = await readLiveMeta(CWD, fs, () => false)
  assert.equal(healed!.status, 'stopped')
  assert.equal(healed!.pendingChoice, undefined, 'a dead run is not awaiting anything')
  // The live log now ends: a dashboard replaying it sees the agent finish and expires the gate.
  const end = lastEvent(fs.files.get(EVENTS)!)
  assert.equal(end['kind'], 'end')
  assert.equal(end['ok'], false)
  assert.equal(end['stopped'], true)
  // The archived copy carries the ending too — it is what history readers replay.
  const archived = fs.files.get(join(RUNS, '2026-gated.jsonl'))!
  assert.equal(lastEvent(archived)['kind'], 'end')
  assert.equal((JSON.parse(fs.files.get(join(RUNS, '2026-gated.json'))!) as AgentMeta).pendingChoice, undefined)
})

test('archiveWorktreeAgent writes the missing end into the worktree before copying (#1359)', async () => {
  const fs = memFs(worktreeFiles('r1', JSON.parse(deadGatedMeta('r1')) as Record<string, unknown>, CHOICE_LINE))
  const meta = await archiveWorktreeAgent(worktreeAt('r1'), CWD, fs)
  assert.equal(meta?.status, 'stopped')
  assert.equal(meta?.pendingChoice, undefined)
  // Both copies of the log end — the worktree's own (a live tail may still be reading it)
  // and the archive the history replays.
  assert.equal(lastEvent(fs.files.get(join(worktreeAt('r1'), '.the-framework', 'events.jsonl'))!)['kind'], 'end')
  assert.equal(lastEvent(fs.files.get(join(CWD, '.the-framework', 'agents', 'r1.jsonl'))!)['kind'], 'end')
})

test('archiveWorktreeAgent leaves a run that wrote its own ending alone (#1359)', async () => {
  const events = '{"kind":"end","ok":true}\n'
  const fs = memFs(worktreeFiles('r1', { version: 1, status: 'done', id: 'r1', startedAt: AT, updatedAt: AT }, events))
  await archiveWorktreeAgent(worktreeAt('r1'), CWD, fs)
  assert.equal(fs.files.get(join(worktreeAt('r1'), '.the-framework', 'events.jsonl')), events, 'no surrogate end on a clean run')
})

test('reconcileOrphanedAgents ends an archived run stuck at running, gate included (#1359)', async () => {
  const fs = memFs({
    [join(RUNS, 'a.json')]: deadGatedMeta('a'),
    [join(RUNS, 'a.jsonl')]: CHOICE_LINE,
  })
  assert.equal(await reconcileOrphanedAgents(CWD, fs, () => false), 1)
  const meta = JSON.parse(fs.files.get(join(RUNS, 'a.json'))!) as AgentMeta
  assert.equal(meta.status, 'stopped')
  assert.equal(meta.pendingChoice, undefined)
  assert.equal(lastEvent(fs.files.get(join(RUNS, 'a.jsonl'))!)['kind'], 'end')
})

test('reconcileOrphanedAgents ends a dead worktree run in place and in the archive (#1359)', async () => {
  const fs = memFs(worktreeFiles('wt1', JSON.parse(deadGatedMeta('wt1')) as Record<string, unknown>, CHOICE_LINE))
  assert.equal(await reconcileOrphanedAgents(CWD, fs, () => false), 1)
  const inPlace = JSON.parse(fs.files.get(join(worktreeAt('wt1'), '.the-framework', 'agent.json'))!) as AgentMeta
  assert.equal(inPlace.status, 'stopped')
  assert.equal(inPlace.pendingChoice, undefined)
  assert.equal(lastEvent(fs.files.get(join(worktreeAt('wt1'), '.the-framework', 'events.jsonl'))!)['kind'], 'end')
  assert.equal(lastEvent(fs.files.get(join(CWD, '.the-framework', 'agents', 'wt1.jsonl'))!)['kind'], 'end')
})

test('open records the run flow, and a continuation preserves the first leg\'s (#1467)', async () => {
  const fs = memFs()
  const store = await AgentStore.open(CWD, { fs, fresh: true, now: AT, kind: 'build' })
  assert.equal(store.snapshot().kind, 'build')
  // The composer's Resume arrives as a prompt start; the reopened meta keeps the build record.
  const reopened = await AgentStore.open(CWD, { fs, fresh: true, continueAgent: true, now: AT, kind: 'prompt' })
  assert.equal(reopened.snapshot().kind, 'build')
})

test('a continuation keeps its original label through a re-entered scope event (#1467)', async () => {
  const fs = memFs()
  const first = await AgentStore.open(CWD, { fs, fresh: true, now: AT, intent: 'build a thing', kind: 'build' })
  await first.append({ kind: 'end', ok: false, stopped: true })
  // A continuation's own intent event carries the resume message — the reopened session keeps its
  // original intent (#762), not the message that woke it.
  const resumed = await AgentStore.open(CWD, { fs, fresh: true, continueAgent: true, now: AT })
  await resumed.append({ kind: 'intent', text: 'Resume: keep going.' })
  assert.equal(resumed.snapshot().intent, 'build a thing')
})
