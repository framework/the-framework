import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { CLOUD_COMMAND, CloudDriver, type RunPtyOptions } from './cloud.js'
import type { DriverEvent } from './types.js'

/**
 * What the CLI actually prints on a successful `--cloud`, captured from a real run. The
 * escape codes are part of the fixture on purpose: this output comes off a terminal, so the
 * parser has to read through them rather than around them.
 */
const CREATED = [
  '\x1b[?25l\x1b[2K',
  'Created cloud session: Add the --verbose flag\r\n',
  'View: \x1b[4mhttps://claude.ai/code/session_01ABCdefGHIjklMNO?from=cli&m=0\x1b[24m\r\n',
  'Resume with: claude --teleport session_01ABCdefGHIjklMNO\r\n',
  '\x1b[?25h',
].join('')

const URL = 'https://claude.ai/code/session_01ABCdefGHIjklMNO?from=cli&m=0'
const SESSION = 'session_01ABCdefGHIjklMNO'

/** A pty runner that replays a fixed transcript, recording how it was called. */
function fakePty(output: string, calls: RunPtyOptions[] = []) {
  return {
    calls,
    run: async (opts: RunPtyOptions) => {
      calls.push(opts)
      opts.onData(output)
      // A real invocation keeps holding the terminal until the caller aborts, so only
      // return once aborted — a runner that returned early would hide that.
      if (!opts.signal.aborted) await new Promise<void>(r => opts.signal.addEventListener('abort', () => r(), { once: true }))
    },
  }
}

function driverWith(output: string, calls: RunPtyOptions[] = []) {
  const pty = fakePty(output, calls)
  return new CloudDriver({ runPty: pty.run, runTag: () => 'tag', timeoutMs: 1000 })
}

test('a prompt creates a cloud session and returns its id', async () => {
  const session = await driverWith(CREATED).start({ cwd: '/repo' })
  const turn = await session.prompt('Add the --verbose flag')
  assert.equal(turn.sessionId, SESSION)
  assert.match(turn.text, /Claude Code on the web/)
  assert.match(turn.text, new RegExp(SESSION))
})

test('the session link rides an `action` event, the way the Actions run link does', async () => {
  const events: DriverEvent[] = []
  const session = await driverWith(CREATED).start({ cwd: '/repo', onEvent: e => events.push(e) })
  await session.prompt('go')
  assert.ok(events.some(e => e.type === 'action' && e.label === `cloud ${URL}`))
  assert.ok(events.some(e => e.type === 'result' && e.sessionId === SESSION))
})

test('the prompt carries the session framing and the per-call system prompt', async () => {
  const calls: RunPtyOptions[] = []
  const session = await driverWith(CREATED, calls).start({ cwd: '/repo', system: 'FRAMING' })
  await session.prompt('do the thing', { system: 'EXTRA' })
  assert.equal(calls[0]?.prompt, 'FRAMING\n\nEXTRA\n\ndo the thing')
  assert.equal(calls[0]?.cwd, '/repo')
})

test('the invocation is stopped as soon as the session link lands', async () => {
  const calls: RunPtyOptions[] = []
  const session = await driverWith(CREATED, calls).start({ cwd: '/repo' })
  await session.prompt('go')
  assert.equal(calls[0]?.signal.aborted, true, 'the CLI would otherwise sit holding the terminal')
})

test('output split across chunks still yields the session', async () => {
  const calls: RunPtyOptions[] = []
  const driver = new CloudDriver({
    runTag: () => 'tag',
    timeoutMs: 1000,
    runPty: async opts => {
      calls.push(opts)
      // Split mid-URL: a parser that matched per chunk rather than on the accumulated
      // output would miss this, which is the realistic failure.
      opts.onData('View: https://claude.ai/code/sess')
      opts.onData('ion_01ABCdefGHIjklMNO?from=cli&m=0\r\n')
    },
  })
  const session = await driver.start({ cwd: '/repo' })
  assert.equal((await session.prompt('go')).sessionId, SESSION)
})

test('a run that created no session fails with what the CLI said', async () => {
  const driver = new CloudDriver({
    runTag: () => 'tag',
    timeoutMs: 1000,
    runPty: async opts => opts.onData('Invalid API key · Fix external API key\r\n'),
  })
  const session = await driver.start({ cwd: '/repo' })
  await assert.rejects(session.prompt('go'), /no cloud session was created[\s\S]*Invalid API key/)
})

test('an untrusted workspace fails fast and says how to fix it, rather than hanging', async () => {
  // The dialog is drawn with cursor moves, so the words arrive with no literal spaces
  // between them — matching has to survive that, which is why this fixture looks like this.
  const events: DriverEvent[] = []
  const driver = new CloudDriver({
    runTag: () => 'tag',
    timeoutMs: 1000,
    runPty: async opts => {
      opts.onData('\x1b[2KQuick\x1b[Csafety\x1b[Ccheck\r\n1.\x1b[CYes,\x1b[CI\x1b[Ctrust\x1b[Cthis\x1b[Cfolder\r\n')
      // The driver aborts synchronously from inside onData, so check before waiting: a
      // listener added after the fact never fires.
      if (!opts.signal.aborted) await new Promise<void>(r => opts.signal.addEventListener('abort', () => r(), { once: true }))
    },
  })
  const session = await driver.start({ cwd: '/repo', onEvent: e => events.push(e) })
  await assert.rejects(session.prompt('go'), /no cloud session was created/)
  const notice = events.find(e => e.type === 'notice')
  assert.ok(notice && /has not been trusted in \/repo/.test(notice.message))
  assert.ok(notice && /Run `claude` there once/.test(notice.message))
})

test('the prompt sits directly after --cloud, ahead of the model flag', () => {
  // The description is `--cloud`'s own value, not a positional argument. With the model flag
  // in between, every run on an account with a model preference died on "--cloud requires a
  // description" while runs without one worked, which is what made it look unrelated to the
  // model at first. Nothing else observes this order, so it is pinned here.
  const promptAt = CLOUD_COMMAND.indexOf('"$FW_CLOUD_PROMPT"')
  const modelAt = CLOUD_COMMAND.indexOf('FW_CLOUD_MODEL')
  assert.ok(promptAt > 0 && modelAt > 0)
  assert.ok(promptAt < modelAt, 'the prompt must be the argument to --cloud')
  assert.match(CLOUD_COMMAND, /--cloud "\$FW_CLOUD_PROMPT"/)
})

test('the shell command never interpolates the prompt or the model as syntax', () => {
  // Both arrive through the environment, so the hosted command stays a fixed literal.
  assert.ok(!CLOUD_COMMAND.includes('${FW_CLOUD_PROMPT}'))
  assert.match(CLOUD_COMMAND, /^exec "\$FW_CLOUD_BIN"/)
})

test('an unsafe model id never reaches the shell', async () => {
  const calls: RunPtyOptions[] = []
  const session = await driverWith(CREATED, calls).start({ cwd: '/repo', model: 'opus"; rm -rf /' })
  await assert.rejects(session.prompt('go'), /unsafe model id/)
  assert.equal(calls.length, 0, 'nothing should have been spawned')
})

test('a safe model id is passed through', async () => {
  const calls: RunPtyOptions[] = []
  const session = await driverWith(CREATED, calls).start({ cwd: '/repo', model: 'claude-opus-5' })
  await session.prompt('go')
  assert.equal(calls[0]?.model, 'claude-opus-5')
})

test('each prompt creates its own cloud session, since one cannot be continued', async () => {
  const calls: RunPtyOptions[] = []
  const session = await driverWith(CREATED, calls).start({ cwd: '/repo' })
  await session.prompt('first')
  await session.prompt('second')
  assert.equal(calls.length, 2)
  assert.equal(calls[1]?.prompt, 'second')
})

test('session ids are unique per session, so two runs never collide', async () => {
  const driver = new CloudDriver({ runPty: fakePty(CREATED).run })
  const a = await driver.start({ cwd: '/repo' })
  const b = await driver.start({ cwd: '/repo' })
  assert.notEqual(a.id, b.id)
})

test('a disposed session refuses further prompts', async () => {
  const session = await driverWith(CREATED).start({ cwd: '/repo' })
  await session.dispose()
  await assert.rejects(session.prompt('go'), /disposed/)
})

test('an already-aborted signal stops the prompt before spawning anything', async () => {
  const calls: RunPtyOptions[] = []
  const controller = new AbortController()
  controller.abort()
  const session = await driverWith(CREATED, calls).start({ cwd: '/repo', signal: controller.signal })
  await assert.rejects(session.prompt('go'), /aborted/)
  assert.equal(calls.length, 0)
})

test('there is no readCode: the workspace lives in a cloud VM', async () => {
  const session = await driverWith(CREATED).start({ cwd: '/repo' })
  assert.equal(session.readCode, undefined)
})
