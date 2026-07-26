import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { createServer, type Server } from 'node:http'
import { AddressInfo } from 'node:net'
import { BRIDGE_PREFIX, handleBridgeRequest, type BridgeHandlers, type BridgeQuestion } from './bridge-endpoints.js'

const TOKEN = 'a'.repeat(43)

/** A server wired exactly the way `startDashboard` wires the bridge, recording what it accepts. */
async function serve(handlers: BridgeHandlers | undefined): Promise<{ url: string; got: BridgeQuestion[]; close: () => Promise<void> }> {
  const got: BridgeQuestion[] = []
  const wired = handlers ? { ...handlers, record: (q: BridgeQuestion) => void got.push(q) } : undefined
  const server: Server = createServer((req, res) => {
    const pathname = new URL(req.url ?? '/', 'http://localhost').pathname
    void handleBridgeRequest(req, res, pathname, wired)
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${port}`,
    got,
    close: () =>
      new Promise<void>(resolve => {
        server.closeAllConnections()
        server.close(() => resolve())
      }),
  }
}

const QUESTION = {
  sessionId: 'session_018KtaRYq8N1T9mjrJBTvrNS',
  title: 'What would you like me to do?',
  options: [{ label: 'Work on the next TODO', detail: 'the first open entry' }, { label: 'Tell you about current state' }],
  recommended: 'Work on the next TODO',
}

// `null` rather than `undefined` for "send no token": passing undefined to a defaulted
// parameter uses the default, which quietly sent a valid token and turned a 401 case into 204.
function post(url: string, body: unknown, token: string | null = TOKEN): Promise<Response> {
  return fetch(`${url}${BRIDGE_PREFIX}/question`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

test('a valid question is recorded and stamped by the daemon, not the caller (#1237)', async () => {
  const s = await serve({ token: TOKEN, record: () => {}, now: () => new Date('2026-07-26T18:00:00.000Z') })
  try {
    const res = await post(s.url, { ...QUESTION, receivedAt: 'whenever the caller likes' })
    assert.equal(res.status, 204)
    assert.equal(s.got.length, 1)
    assert.equal(s.got[0]!.title, QUESTION.title)
    assert.equal(s.got[0]!.options.length, 2)
    // The caller's own timestamp is ignored: it is the daemon's record of when it heard.
    assert.equal(s.got[0]!.receivedAt, '2026-07-26T18:00:00.000Z')
  } finally {
    await s.close()
  }
})

test('the bridge is off unless a token was wired, and then everything 404s (#1237)', async () => {
  const s = await serve(undefined)
  try {
    const res = await post(s.url, QUESTION)
    assert.equal(res.status, 404)
    assert.equal(s.got.length, 0)
  } finally {
    await s.close()
  }
})

test('a wrong or missing token is refused before the body is read (#1237)', async () => {
  const s = await serve({ token: TOKEN, record: () => {} })
  try {
    assert.equal((await post(s.url, QUESTION, null)).status, 401)
    assert.equal((await post(s.url, QUESTION, 'b'.repeat(43))).status, 401)
    // A token of a different length must not throw out of timingSafeEqual.
    assert.equal((await post(s.url, QUESTION, 'short')).status, 401)
    assert.equal(s.got.length, 0)
  } finally {
    await s.close()
  }
})

test('the payload is validated field by field, with a reason (#1237)', async () => {
  const s = await serve({ token: TOKEN, record: () => {} })
  try {
    const cases: [string, unknown, RegExp][] = [
      ['not JSON', '{oops', /JSON/],
      ['not an object', 42, /object/],
      ['a session id that is not one', { ...QUESTION, sessionId: '../../etc/passwd' }, /sessionId/],
      ['an empty title', { ...QUESTION, title: '   ' }, /title/],
      ['no options', { ...QUESTION, options: [] }, /options/],
      ['an option with no label', { ...QUESTION, options: [{ detail: 'x' }] }, /label/],
      ['too many options', { ...QUESTION, options: Array.from({ length: 21 }, () => ({ label: 'x' })) }, /at most/],
      // A recommendation naming no option would render a default the user cannot see.
      ['a recommendation matching nothing', { ...QUESTION, recommended: 'something else' }, /recommended/],
    ]
    for (const [name, body, reason] of cases) {
      const res = await post(s.url, body)
      assert.equal(res.status, 400, name)
      assert.match(await res.text(), reason, name)
    }
    assert.equal(s.got.length, 0)
  } finally {
    await s.close()
  }
})

test('an oversized body is refused rather than buffered (#1237)', async () => {
  const s = await serve({ token: TOKEN, record: () => {} })
  try {
    const huge = { ...QUESTION, options: [{ label: 'x', detail: 'y'.repeat(200_000) }] }
    const res = await post(s.url, huge).catch(() => undefined)
    // The daemon destroys the request past the cap, so either a 400 or a torn-down socket is
    // correct; what matters is that nothing was recorded.
    if (res) assert.equal(res.status, 400)
    assert.equal(s.got.length, 0)
  } finally {
    await s.close()
  }
})

test('only POST reaches the question route, and ping proves reachability (#1237)', async () => {
  const s = await serve({ token: TOKEN, record: () => {} })
  try {
    const get = await fetch(`${s.url}${BRIDGE_PREFIX}/question`, { headers: { authorization: `Bearer ${TOKEN}` } })
    assert.equal(get.status, 405)
    const ping = await fetch(`${s.url}${BRIDGE_PREFIX}/ping`, { headers: { authorization: `Bearer ${TOKEN}` } })
    assert.equal(ping.status, 200)
    // Ping is guarded too: reachability is not public.
    assert.equal((await fetch(`${s.url}${BRIDGE_PREFIX}/ping`)).status, 401)
  } finally {
    await s.close()
  }
})

test('no CORS headers are offered, so a page cannot post on the user behalf (#1237)', async () => {
  const s = await serve({ token: TOKEN, record: () => {} })
  try {
    const res = await post(s.url, QUESTION)
    // A wildcard here would let any site the user visits reach their daemon. The extension
    // posts from its background worker, which needs no preflight.
    assert.equal(res.headers.get('access-control-allow-origin'), null)
  } finally {
    await s.close()
  }
})
