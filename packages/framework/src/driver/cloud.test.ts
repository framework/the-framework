import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { isHandsOff } from '../agent-location.js'
import { CLOUD_PROMPT_SEPARATOR, CloudDriver, cloudHandOffPrompt, type ExtensionStart } from './cloud.js'
import type { DriverEvent } from 'agent-driver'

const SESSION = 'session_01ABCdefGHIjklMNO'
const URL = `https://claude.ai/code/${SESSION}`

/** The anchor sha the fake git mints for `commit-tree` (#1601). */
const ANCHOR = 'a'.repeat(40)

/**
 * A git runner with a GitHub origin, recording its calls; `fail` makes the push reject (#1320);
 * `noRemote` answers `remote get-url` as a repo without one.
 */
function fakeGit({ calls = [] as string[][], fail = false, noRemote = false } = {}) {
  return {
    calls,
    run: async (args: string[], _cwd: string): Promise<string> => {
      calls.push([...args])
      if (args[0] === 'remote') {
        if (noRemote) throw new Error('no such remote')
        return 'git@github.com:framework/the-framework.git\n'
      }
      if (args[0] === 'commit-tree') return `${ANCHOR}\n`
      if (args[0] === 'push' && fail) throw new Error('no pushable remote')
      return ''
    },
  }
}

/**
 * A daemon whose start-queue answers as scripted: the POST gets `queue`, then each poll pops the
 * next `states` entry (the last one repeats). Records every request the run made.
 */
function fakeDaemon(queue: { status: number; body?: unknown }, states: unknown[]) {
  const requests: { method: string; path: string; body?: unknown }[] = []
  const doFetch = (async (input: string | globalThis.URL | Request, init?: RequestInit) => {
    const path = new globalThis.URL(String(input)).pathname
    const method = init?.method ?? 'GET'
    requests.push({ method, path, ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}) })
    if (method === 'POST') {
      return new Response(queue.body === undefined ? 'nope' : JSON.stringify(queue.body), { status: queue.status })
    }
    const state = states.length > 1 ? states.shift() : states[0]
    return new Response(JSON.stringify(state), { status: 200 })
  }) as typeof fetch
  return { requests, fetch: doFetch }
}

const CREATED = [{ state: 'queued' }, { state: 'claimed' }, { state: 'created', sessionId: SESSION, url: URL }]

function driverWith(daemon = fakeDaemon({ status: 202, body: { id: 'req-1' } }, [...CREATED]), git = fakeGit(), opts: Partial<ExtensionStart> = {}) {
  const extension: ExtensionStart = { daemonUrl: 'http://127.0.0.1:4200/', token: 'tok', fetch: daemon.fetch, pollMs: 1, ...opts }
  return new CloudDriver({ extension, git: git.run, agentTag: () => 'tag', timeoutMs: 1000 })
}

test('a prompt has the extension create a cloud session and returns its id (#1328)', async () => {
  const daemon = fakeDaemon({ status: 202, body: { id: 'req-1' } }, [...CREATED])
  const session = await driverWith(daemon).start({ cwd: '/repo' })
  const turn = await session.prompt('Add the --verbose flag')
  assert.equal(turn.sessionId, SESSION)
  assert.match(turn.text, /Claude Code on the web/)
  assert.match(turn.text, new RegExp(SESSION))
  // The request names the repo the picker lists, the pushed hand-off ref, and the whole prompt.
  const post = daemon.requests.find(r => r.method === 'POST')
  assert.deepEqual(post?.body, { repo: 'framework/the-framework', branch: session.id, prompt: 'Add the --verbose flag' })
  assert.equal(daemon.requests.filter(r => r.method === 'GET').length, 3, 'polled until created')
})

test('the model the run was started with travels with the request, and an unset one does not (#1697)', async () => {
  const daemon = fakeDaemon({ status: 202, body: { id: 'req-1' } }, [...CREATED])
  const session = await driverWith(daemon).start({ cwd: '/repo', model: 'sonnet' })
  await session.prompt('Add the --verbose flag')
  const post = daemon.requests.find(r => r.method === 'POST')
  assert.deepEqual(post?.body, { repo: 'framework/the-framework', branch: session.id, prompt: 'Add the --verbose flag', model: 'sonnet' })
})

test('the session link rides an `action` event, the way the Actions run link does', async () => {
  const events: DriverEvent[] = []
  const session = await driverWith().start({ cwd: '/repo', onEvent: e => events.push(e) })
  await session.prompt('go')
  assert.ok(events.some(e => e.type === 'action' && e.label === `cloud ${URL}`))
  assert.ok(events.some(e => e.type === 'result' && e.sessionId === SESSION))
  // The result also carries the real URL (#1317), which is what reaches the agent meta.
  assert.ok(events.some(e => e.type === 'result' && e.sessionLink === URL))
  assert.ok(events.some(e => e.type === 'notice' && /asked the browser extension/.test(e.message)))
})

test('the task leads the prompt; framing and per-call system follow behind labeled rules (#1497)', async () => {
  const daemon = fakeDaemon({ status: 202, body: { id: 'req-1' } }, [...CREATED])
  const session = await driverWith(daemon).start({ cwd: '/repo', system: 'FRAMING' })
  await session.prompt('do the thing', { system: 'EXTRA' })
  const post = daemon.requests.find(r => r.method === 'POST')
  assert.equal(
    (post?.body as { prompt: string }).prompt,
    [
      'do the thing',
      CLOUD_PROMPT_SEPARATOR,
      'Instructions from The Framework, the tool that started this session:\n\nFRAMING',
      CLOUD_PROMPT_SEPARATOR,
      'EXTRA',
    ].join('\n\n\n'),
  )
})

test('cloudHandOffPrompt with nothing injected is the bare task — no rule, no label', () => {
  assert.equal(cloudHandOffPrompt('do the thing'), 'do the thing')
  assert.equal(cloudHandOffPrompt('do the thing', undefined, undefined), 'do the thing')
})

test('the hand-off pushes the anchor under the agent id and hands the session that ref (#1320/#1601)', async () => {
  const git = fakeGit()
  const daemon = fakeDaemon({ status: 202, body: { id: 'req-1' } }, [...CREATED])
  const events: DriverEvent[] = []
  const session = await driverWith(daemon, git).start({ cwd: '/repo', onEvent: e => events.push(e) })
  await session.prompt('go')
  const commitTree = git.calls.find(c => c[0] === 'commit-tree')
  assert.deepEqual(commitTree, ['commit-tree', 'HEAD^{tree}', '-p', 'HEAD', '-m', `[The Framework] web hand-off ${session.id}`])
  const push = git.calls.find(c => c[0] === 'push')
  assert.deepEqual(push, ['push', 'origin', `${ANCHOR}:refs/heads/${session.id}`])
  assert.ok(git.calls.indexOf(push!) < daemon.requests.length + git.calls.indexOf(push!), 'pushed before the request')
  assert.equal((daemon.requests.find(r => r.method === 'POST')?.body as { branch: string }).branch, session.id)
  // The anchor is recorded on the result, so the branch can be recognized later (#1601).
  assert.ok(events.some(e => e.type === 'result' && e.anchorSha === ANCHOR))
})

test('a failed pre-push fails the run naming the remote, since the session must open on that ref (#1320)', async () => {
  const daemon = fakeDaemon({ status: 202, body: { id: 'req-1' } }, [...CREATED])
  const session = await driverWith(daemon, fakeGit({ fail: true })).start({ cwd: '/repo' })
  await assert.rejects(session.prompt('go'), /could not push the hand-off ref .* pushable GitHub remote/)
  assert.equal(daemon.requests.length, 0, 'nothing was asked of the extension')
})

test('a checkout with no GitHub remote fails naming the need, before pushing anything (#1328)', async () => {
  const git = fakeGit({ noRemote: true })
  const daemon = fakeDaemon({ status: 202, body: { id: 'req-1' } }, [...CREATED])
  const session = await driverWith(daemon, git).start({ cwd: '/repo' })
  await assert.rejects(session.prompt('go'), /no GitHub remote here/)
  assert.ok(!git.calls.some(c => c[0] === 'push'))
  assert.equal(daemon.requests.length, 0)
})

test('a run no daemon spawned fails saying web runs start from the dashboard (#1328)', async () => {
  const session = await new CloudDriver({ git: fakeGit().run, agentTag: () => 'tag' }).start({ cwd: '/repo' })
  await assert.rejects(session.prompt('go'), /not started by a daemon.*start web runs from the dashboard/)
})

test('no extension around (409) and a bridge that is off (404) each fail naming the cure (#1328)', async () => {
  const none = await driverWith(fakeDaemon({ status: 409 }, [])).start({ cwd: '/repo' })
  await assert.rejects(none.prompt('go'), /no browser extension has spoken .* install or reload/)
  const off = await driverWith(fakeDaemon({ status: 404 }, [])).start({ cwd: '/repo' })
  await assert.rejects(off.prompt('go'), /browser bridge is off .* Settings/)
})

test('an extension that tried and failed fails the turn with its note (#1328)', async () => {
  const daemon = fakeDaemon({ status: 202, body: { id: 'req-1' } }, [{ state: 'failed', note: 'no repo picker on the page' }])
  const session = await driverWith(daemon).start({ cwd: '/repo' })
  await assert.rejects(session.prompt('go'), /could not create the session — no repo picker on the page/)
})

test('a run hands off ONCE, however many times the loop prompts', async () => {
  const daemon = fakeDaemon({ status: 202, body: { id: 'req-1' } }, [...CREATED])
  const session = await driverWith(daemon).start({ cwd: '/repo' })
  const first = await session.prompt('go')
  const second = await session.prompt('and again')
  const third = await session.prompt('once more')
  assert.equal(daemon.requests.filter(r => r.method === 'POST').length, 1, 'one cloud session, not three')
  assert.equal(second.sessionId, first.sessionId)
  assert.equal(third.sessionId, first.sessionId)
})

test('a later pass says the work is already in the cloud, rather than repeating the hand-off', async () => {
  const session = await driverWith().start({ cwd: '/repo' })
  const first = await session.prompt('go')
  const again = await session.prompt('go on')
  assert.match(first.text, /Handed off to Claude Code on the web/)
  assert.match(again.text, /already/)
  assert.doesNotMatch(again.text, /Handed off to Claude Code on the web\./)
})

test('the cloud link event fires once, so the run view shows one session', async () => {
  const events: DriverEvent[] = []
  const session = await driverWith().start({ cwd: '/repo', onEvent: e => events.push(e) })
  await session.prompt('go')
  await session.prompt('go on')
  assert.equal(events.filter(e => e.type === 'action').length, 1)
})

test('session ids are unique per session, so two runs never collide', async () => {
  const driver = new CloudDriver({ git: fakeGit().run })
  const a = await driver.start({ cwd: '/repo' })
  const b = await driver.start({ cwd: '/repo' })
  assert.notEqual(a.id, b.id)
})

test('a disposed session refuses further prompts', async () => {
  const session = await driverWith().start({ cwd: '/repo' })
  await session.dispose()
  await assert.rejects(session.prompt('go'), /disposed/)
})

test('an already-aborted signal stops the prompt before asking anything', async () => {
  const daemon = fakeDaemon({ status: 202, body: { id: 'req-1' } }, [...CREATED])
  const controller = new AbortController()
  controller.abort()
  const session = await driverWith(daemon).start({ cwd: '/repo', signal: controller.signal })
  await assert.rejects(session.prompt('go'), /aborted/)
  assert.equal(daemon.requests.length, 0)
})

test('waiting past the timeout gives up naming the extension', async () => {
  const daemon = fakeDaemon({ status: 202, body: { id: 'req-1' } }, [{ state: 'claimed' }])
  const extension: ExtensionStart = { daemonUrl: 'http://127.0.0.1:4200', token: 'tok', fetch: daemon.fetch, pollMs: 5 }
  const session = await new CloudDriver({ extension, git: fakeGit().run, agentTag: () => 'tag', timeoutMs: 40 }).start({ cwd: '/repo' })
  await assert.rejects(session.prompt('go'), /gave up waiting for the browser extension/)
})

test('there is no readCode: the workspace lives in a cloud VM', async () => {
  const session = await driverWith().start({ cwd: '/repo' })
  assert.equal(session.readCode, undefined)
})

test('the web location is the hand-off, so a run ends at the first prompt (#1225/D1)', () => {
  assert.equal(isHandsOff('web'), true)
  assert.equal(isHandsOff('local'), false)
  assert.equal(isHandsOff('actions'), false)
})
