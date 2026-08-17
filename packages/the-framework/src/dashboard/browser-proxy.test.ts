import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { parseBrowserRoute, handleBrowserProxy, type BrowserPortLookup } from './browser-proxy.js'

// #813: the pane is served through the daemon so it stays same-origin, and so the agent's own
// port is never something a client gets to name.

test('parseBrowserRoute reads a project, a run, and a leg', () => {
  assert.deepEqual(parseBrowserRoute('/browser/proj/2026-07-19T10-00-00-000Z/stream'), {
    projectId: 'proj',
    agentId: '2026-07-19T10-00-00-000Z',
    leg: 'stream',
  })
  assert.equal(parseBrowserRoute('/browser/proj/run/input')?.leg, 'input')
})

test('parseBrowserRoute ignores anything that is not a browser route', () => {
  // Must fall through to the client bundle rather than be guessed at.
  for (const url of ['/', '/assets/app.js', '/browser', '/browser/proj', '/browser/proj/run', '/browser/a/b/c/d']) {
    assert.equal(parseBrowserRoute(url), undefined, url)
  }
})

test('parseBrowserRoute rejects a leg it does not serve', () => {
  assert.equal(parseBrowserRoute('/browser/proj/run/evict'), undefined)
})

test('parseBrowserRoute keeps a query string out of the leg', () => {
  assert.equal(parseBrowserRoute('/browser/proj/run/stream?t=1')?.leg, 'stream')
})

test('parseBrowserRoute survives a malformed escape or target instead of throwing (#938)', () => {
  // `%zz` passes URL parsing and only explodes at decode time; a throw here escapes the
  // void-dispatched proxy handler and kills the daemon.
  assert.equal(parseBrowserRoute('/browser/proj/%zz/stream'), undefined)
  assert.equal(parseBrowserRoute('http://['), undefined)
})

/** A stand-in for the agent's bridge, recording what reached it. */
async function fakeBridge(): Promise<{ port: number; hits: { url: string; body: string }[]; close: () => void }> {
  const hits: { url: string; body: string }[] = []
  const server: Server = createServer((req, res) => {
    let body = ''
    req.on('data', c => (body += c))
    req.on('end', () => {
      hits.push({ url: req.url ?? '', body })
      if (req.url === '/stream') {
        res.writeHead(200, { 'content-type': 'multipart/x-mixed-replace; boundary=frame' })
        res.end('--frame')
      } else {
        res.writeHead(204).end()
      }
    })
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  return { port: (server.address() as AddressInfo).port, hits, close: () => server.close() }
}

/** Mount the proxy on a real server so the test exercises piping, not just the handler. */
async function proxyServer(lookup: BrowserPortLookup): Promise<{ url: string; close: () => void }> {
  const server = createServer((req, res) => {
    void handleBrowserProxy(req, res, lookup).then(handled => {
      if (!handled) res.writeHead(404).end('fell through')
    })
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, close: () => server.close() }
}

test('proxies the stream to the run bridge', async () => {
  const bridge = await fakeBridge()
  const proxy = await proxyServer(async () => bridge.port)
  try {
    const res = await fetch(`${proxy.url}/browser/proj/run/stream`)
    assert.equal(res.status, 200)
    assert.match(res.headers.get('content-type') ?? '', /multipart\/x-mixed-replace/)
    await res.text()
    assert.equal(bridge.hits[0]?.url, '/stream')
  } finally {
    bridge.close()
    proxy.close()
  }
})

test('forwards an input POST body through to the bridge', async () => {
  const bridge = await fakeBridge()
  const proxy = await proxyServer(async () => bridge.port)
  try {
    const res = await fetch(`${proxy.url}/browser/proj/run/input`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'click', x: 4, y: 2 }),
    })
    assert.equal(res.status, 204)
    assert.deepEqual(JSON.parse(bridge.hits[0]?.body ?? '{}'), { type: 'click', x: 4, y: 2 })
  } finally {
    bridge.close()
    proxy.close()
  }
})

test('404s a run with no preview rather than reaching for a port', async () => {
  // The ordinary case: an agent started without Browser, or one that already ended.
  const proxy = await proxyServer(async () => undefined)
  try {
    const res = await fetch(`${proxy.url}/browser/proj/run/stream`)
    assert.equal(res.status, 404)
  } finally {
    proxy.close()
  }
})

test('502s when the bridge is gone', async () => {
  // A port from an agent that just died: the connection is refused, and that must answer rather
  // than hang the pane.
  const bridge = await fakeBridge()
  const dead = bridge.port
  // The proxy takes its own port BEFORE the bridge gives its one up. Closing first frees the
  // bridge's port back to the ephemeral pool, and the proxy's `listen(0)` is then sometimes
  // handed that very number (measured at ~1 in 1500 on Linux) — whereupon the proxy dials
  // itself, its own handler does not recognise the bare `/stream` it sends as a browser route,
  // and the 404 it falls through to comes back where this expects the refusal's 502.
  const proxy = await proxyServer(async () => dead)
  bridge.close()
  try {
    const res = await fetch(`${proxy.url}/browser/proj/run/stream`)
    assert.equal(res.status, 502, `expected the refused connection's 502, got ${res.status}: ${await res.text()}`)
  } finally {
    proxy.close()
  }
})

test('a non-browser url is left for the client bundle', async () => {
  const proxy = await proxyServer(async () => 1)
  try {
    const res = await fetch(`${proxy.url}/assets/app.js`)
    assert.equal(await res.text(), 'fell through')
  } finally {
    proxy.close()
  }
})
