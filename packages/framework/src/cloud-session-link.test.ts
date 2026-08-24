import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { CloudDriver } from './driver/cloud.js'
import { createDriverEventHandler, emitSessionStart } from './agent-telemetry.js'
import { metaFromEvents } from './store/index.js'
import { CLAUDE_CODE_SESSION_LINK } from './session-link.js'
import type { FrameworkEvent } from './events.js'

// #1317: a web agent's meta dead-ended on the generic https://claude.ai/code — recorded by the
// opening `session` event before any session existed — even though the CloudDriver had the real
// URL in hand. This wires the real driver through the real telemetry into the real meta fold,
// so the contract that the deep link wins is pinned end to end, not per layer.

const SESSION = 'session_01ABCdefGHIjklMNO'
const URL = `https://claude.ai/code/${SESSION}`

/** A daemon whose start-queue reports the session created on the first poll, and a git with a GitHub origin. */
function extensionThatCreates() {
  const fetchFake = (async (input: string | globalThis.URL | Request, init?: RequestInit) =>
    (init?.method ?? 'GET') === 'POST'
      ? new Response(JSON.stringify({ id: 'req-1' }), { status: 202 })
      : new Response(JSON.stringify({ state: 'created', sessionId: SESSION, url: URL }), { status: 200 })) as typeof fetch
  const git = async (args: string[]): Promise<string> => {
    if (args[0] === 'remote') return 'git@github.com:framework/the-framework.git\n'
    if (args[0] === 'commit-tree') return `${'a'.repeat(40)}\n`
    return ''
  }
  return { extension: { daemonUrl: 'http://127.0.0.1:4200', token: 'tok', fetch: fetchFake, pollMs: 1 }, git }
}

test('a cloud run meta ends with the real session URL, not the generic entry point (#1317)', async () => {
  const events: FrameworkEvent[] = []
  const handler = createDriverEventHandler({
    emit: e => events.push(e),
    // What a Claude agent gets without an explicit session link: the generic entry point.
    sessionLink: CLAUDE_CODE_SESSION_LINK,
  })
  const driver = new CloudDriver({ agentTag: () => 'tag', timeoutMs: 1000, ...extensionThatCreates() })
  emitSessionStart({ emit: e => events.push(e), driver, cwd: '/repo', sessionLink: CLAUDE_CODE_SESSION_LINK })
  const session = await driver.start({ cwd: '/repo', onEvent: handler.onDriverEvent })
  await session.prompt('go')

  const meta = metaFromEvents(events, '2026-01-01T00:00:00.000Z')
  assert.equal(meta.sessionLink, URL, 'the meta must carry the deep link once the hand-off knows it')
  // The opening event still honestly says what was known before the session existed.
  const opening = events.find(e => e.kind === 'session')
  assert.ok(opening && 'sessionLink' in opening && opening.sessionLink === CLAUDE_CODE_SESSION_LINK)
})
