import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { CloudDriver } from './driver/cloud.js'
import { createDriverEventHandler, emitSessionStart } from './agent-telemetry.js'
import { metaFromEvents } from './store/index.js'
import { CLAUDE_CODE_SESSION_LINK } from './session-link.js'
import type { FrameworkEvent } from './events.js'

// #1317: a web run's meta dead-ended on the generic https://claude.ai/code — recorded by the
// opening `session` event before any session existed — even though the CloudDriver had the real
// URL in hand. This wires the real driver through the real telemetry into the real meta fold,
// so the contract that the deep link wins is pinned end to end, not per layer.

const URL = 'https://claude.ai/code/session_01ABCdefGHIjklMNO?from=cli&m=0'
const CREATED = [
  '\x1b[?25l\x1b[2K',
  'Created cloud session: Add the --verbose flag\r\n',
  `View: \x1b[4m${URL}\x1b[24m\r\n`,
  'Resume with: claude --teleport session_01ABCdefGHIjklMNO\r\n',
  '\x1b[?25h',
].join('')

test('a cloud run meta ends with the real session URL, not the generic entry point (#1317)', async () => {
  const events: FrameworkEvent[] = []
  const handler = createDriverEventHandler({
    emit: e => events.push(e),
    // What a Claude run gets without an explicit session link: the generic entry point.
    sessionLink: CLAUDE_CODE_SESSION_LINK,
  })
  const driver = new CloudDriver({
    agentTag: () => 'tag',
    timeoutMs: 1000,
    runPty: async opts => {
      opts.onData(CREATED)
      if (!opts.signal.aborted) await new Promise<void>(r => opts.signal.addEventListener('abort', () => r(), { once: true }))
    },
  })
  emitSessionStart({ emit: e => events.push(e), driver, cwd: '/repo', sessionLink: CLAUDE_CODE_SESSION_LINK })
  const session = await driver.start({ cwd: '/repo', onEvent: handler.onDriverEvent })
  await session.prompt('go')

  const meta = metaFromEvents(events, '2026-01-01T00:00:00.000Z')
  assert.equal(meta.sessionLink, URL, 'the meta must carry the deep link once the hand-off knows it')
  // The opening event still honestly says what was known before the session existed.
  const opening = events.find(e => e.kind === 'session')
  assert.ok(opening && 'sessionLink' in opening && opening.sessionLink === CLAUDE_CODE_SESSION_LINK)
})
