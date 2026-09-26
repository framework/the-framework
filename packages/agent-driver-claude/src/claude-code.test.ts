import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { Readable, Writable } from 'node:stream'
import { existsSync, readFileSync } from 'node:fs'
import { ClaudeCodeDriver, StreamJsonParser, claudeCodeReady } from './claude-code.js'
import { runCliSession, type SpawnLike, type SpawnedProcess, type DriverEvent } from 'agent-driver'

test('StreamJsonParser surfaces assistant text + tool names, keeps the result', () => {
  const p = new StreamJsonParser()
  // The very first line announces the session id (#1322): surfaced immediately, not held for
  // `result`, so a turn that is stopped mid-flight keeps its `claude --resume` handle.
  assert.deepEqual(p.push(JSON.stringify({ type: 'system', subtype: 'init', session_id: 'sess-1' })), [
    { type: 'session', sessionId: 'sess-1' },
  ])
  const assistant = p.push(
    JSON.stringify({
      type: 'assistant',
      session_id: 'sess-1',
      message: { role: 'assistant', content: [{ type: 'text', text: 'Working' }, { type: 'tool_use', name: 'Write' }] },
    }),
  )
  assert.deepEqual(assistant, [
    { type: 'text', text: 'Working' },
    { type: 'action', label: 'Write' },
  ])
  assert.deepEqual(p.push(JSON.stringify({ type: 'result', subtype: 'success', result: 'All done', session_id: 'sess-1' })), [])
  assert.deepEqual(p.result(), { text: 'All done', sessionId: 'sess-1' })
})

test('StreamJsonParser pulls token + cost usage off the result line (#322)', () => {
  const p = new StreamJsonParser()
  p.push(
    JSON.stringify({
      type: 'result',
      subtype: 'success',
      result: 'done',
      session_id: 's',
      total_cost_usd: 0.1234,
      usage: { input_tokens: 100, output_tokens: 40, cache_read_input_tokens: 900, cache_creation_input_tokens: 50 },
    }),
  )
  assert.deepEqual(p.result(), {
    text: 'done',
    sessionId: 's',
    usage: { costUsd: 0.1234, inputTokens: 100, outputTokens: 40, cacheReadTokens: 900, cacheCreationTokens: 50 },
  })
})

test('StreamJsonParser leaves usage off when the result line reports none (#322)', () => {
  const p = new StreamJsonParser()
  p.push(JSON.stringify({ type: 'result', subtype: 'success', result: 'done', session_id: 's' }))
  assert.deepEqual(p.result(), { text: 'done', sessionId: 's' })
})

test('StreamJsonParser omits costUsd (never 0) when tokens report but no price (#540)', () => {
  const p = new StreamJsonParser()
  p.push(
    JSON.stringify({
      type: 'result',
      subtype: 'success',
      result: 'done',
      session_id: 's',
      usage: { input_tokens: 100, output_tokens: 40, cache_read_input_tokens: 900, cache_creation_input_tokens: 50 },
    }),
  )
  const { usage } = p.result()
  // Tokens surface; costUsd is absent (unknown), not 0 (which the budget gate reads as free).
  assert.equal(usage?.costUsd, undefined)
  assert.equal(Object.prototype.hasOwnProperty.call(usage, 'costUsd'), false)
  assert.deepEqual(usage, { inputTokens: 100, outputTokens: 40, cacheReadTokens: 900, cacheCreationTokens: 50 })
})

test('StreamJsonParser announces the session id once, re-announcing only a change (#1322)', () => {
  const p = new StreamJsonParser()
  assert.deepEqual(p.push(JSON.stringify({ type: 'system', subtype: 'init', session_id: 'a' })), [{ type: 'session', sessionId: 'a' }])
  // Every subsequent line repeats the id; repeating the announcement would be noise.
  assert.deepEqual(p.push(JSON.stringify({ type: 'system', subtype: 'other', session_id: 'a' })), [])
  assert.deepEqual(p.push(JSON.stringify({ type: 'system', subtype: 'other', session_id: 'b' })), [{ type: 'session', sessionId: 'b' }])
})

test('StreamJsonParser ignores non-JSON noise and falls back to assistant text', () => {
  const p = new StreamJsonParser()
  assert.deepEqual(p.push('some banner line'), [])
  // `null` is valid JSON, so it survives the parse and used to throw on the first field read —
  // inside a readline handler, which takes the daemon and every live agent with it.
  assert.deepEqual(p.push('null'), [])
  p.push(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'partial' }] } }))
  assert.deepEqual(p.result(), { text: 'partial' })
})

// A fake process that streams the given stream-json lines then closes.
function fakeSpawn(lines: string[], code = 0, stderr = ''): SpawnLike {
  return () => {
    const stdout = Readable.from([lines.map(l => l + '\n').join('')])
    const stderrStream = Readable.from(stderr ? [stderr] : [])
    const stdin = new Writable({ write: (_c, _e, cb) => cb() })
    const proc: SpawnedProcess = {
      stdout,
      stderr: stderrStream,
      stdin,
      on(event, listener) {
        if (event === 'close') stdout.on('end', () => (listener as (c: number | null) => void)(code))
        return proc
      },
      kill: () => undefined,
    }
    return proc
  }
}

test('runCliSession with the Claude parser drives a fake process and returns the final turn', async () => {
  const events: DriverEvent[] = []
  const lines = [
    JSON.stringify({ type: 'system', subtype: 'init', session_id: 's9' }),
    JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Bash' }] } }),
    JSON.stringify({ type: 'result', subtype: 'success', result: 'built it', session_id: 's9' }),
  ]
  const turn = await runCliSession({
    bin: 'claude',
    args: ['-p'],
    cwd: '/ws',
    env: {},
    prompt: 'build',
    spawn: fakeSpawn(lines),
    emit: e => events.push(e),
    signals: [],
    parser: new StreamJsonParser(),
    driver: 'claude-code',
  })
  assert.deepEqual(turn, { text: 'built it', sessionId: 's9' })
  assert.equal(events[0]!.type, 'start')
  assert.ok(events.some(e => e.type === 'action' && e.label === 'Bash'))
  assert.equal(events.at(-1)!.type, 'result')
})

test('runCliSession with the Claude parser rejects on a non-zero exit with no result text', async () => {
  await assert.rejects(
    () =>
      runCliSession({
        bin: 'claude',
        args: [],
        cwd: '/ws',
        env: {},
        prompt: 'x',
        spawn: fakeSpawn([], 1, 'boom'),
        emit: () => {},
        signals: [],
        parser: new StreamJsonParser(),
        driver: 'claude-code',
      }),
    /boom/,
  )
})

test('runCliSession with the Claude parser rejects on a non-zero exit even when the agent streamed text', async () => {
  const events: DriverEvent[] = []
  const lines = [JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'started building' }] } })]
  await assert.rejects(
    () =>
      runCliSession({
        bin: 'claude',
        args: [],
        cwd: '/ws',
        env: {},
        prompt: 'x',
        spawn: fakeSpawn(lines, 1),
        emit: e => events.push(e),
        signals: [],
        parser: new StreamJsonParser(),
        driver: 'claude-code',
      }),
    /exited \(1\): started building/,
  )
  assert.equal(events.at(-1)!.type, 'error')
  assert.ok(!events.some(e => e.type === 'result'))
})

test('ClaudeCodeDriver builds correct CLI args (permission mode, system, model)', async () => {
  let captured: string[] = []
  const spawn: SpawnLike = (_cmd, args) => {
    captured = [...args]
    return fakeSpawn([JSON.stringify({ type: 'result', result: 'ok' })])(_cmd, args, { cwd: '/ws', env: {} })
  }
  const driver = new ClaudeCodeDriver({ spawn })
  const session = await driver.start({ cwd: '/ws', system: 'You are a Vike expert', model: 'claude-haiku-4-5-20251001' })
  await session.prompt('go')
  assert.deepEqual(captured.slice(0, 4), ['-p', '--output-format', 'stream-json', '--verbose'])
  assert.ok(captured.includes('--permission-mode'))
  assert.ok(captured.includes('acceptEdits'))
  assert.ok(captured.includes('--append-system-prompt'))
  assert.ok(captured.includes('You are a Vike expert'))
  assert.ok(captured.includes('--model'))
  assert.ok(captured.includes('claude-haiku-4-5-20251001'))
})

test('ClaudeCodeDriver omits --mcp-config when no mcpServers are configured', async () => {
  let captured: string[] = []
  const spawn: SpawnLike = (_cmd, args) => {
    captured = [...args]
    return fakeSpawn([JSON.stringify({ type: 'result', result: 'ok' })])(_cmd, args, { cwd: '/ws', env: {} })
  }
  const session = await new ClaudeCodeDriver({ spawn }).start({ cwd: '/ws' })
  await session.prompt('go')
  assert.ok(!captured.includes('--mcp-config'))
})

test('ClaudeCodeDriver writes an --mcp-config file for mcpServers and cleans it up on dispose', async () => {
  let captured: string[] = []
  const spawn: SpawnLike = (_cmd, args) => {
    captured = [...args]
    return fakeSpawn([JSON.stringify({ type: 'result', result: 'ok' })])(_cmd, args, { cwd: '/ws', env: {} })
  }
  const mcpServers = { 'chrome-devtools': { command: 'npx', args: ['-y', 'chrome-devtools-mcp@latest'] } }
  const session = await new ClaudeCodeDriver({ spawn, mcpServers }).start({ cwd: '/ws' })
  await session.prompt('go')
  const idx = captured.indexOf('--mcp-config')
  assert.ok(idx >= 0)
  const configPath = captured[idx + 1]!
  assert.deepEqual(JSON.parse(readFileSync(configPath, 'utf8')), { mcpServers })
  // The path is stable across prompts in the same session (written once).
  const first = [...captured]
  await session.prompt('again')
  assert.equal(captured[captured.indexOf('--mcp-config') + 1], first[first.indexOf('--mcp-config') + 1])
  await session.dispose()
  assert.ok(!existsSync(configPath))
})

test('ClaudeCodeSession resumes the same session for a chat turn (#714)', async () => {
  let captured: string[] = []
  const spawn: SpawnLike = (_cmd, args) => {
    captured = [...args]
    // The turn reports its session id, which the session retains for a later --resume.
    return fakeSpawn([JSON.stringify({ type: 'result', result: 'ok', session_id: 'sess-1' })])(_cmd, args, { cwd: '/ws', env: {} })
  }
  const session = await new ClaudeCodeDriver({ spawn }).start({ cwd: '/ws', system: 'You are a Vike expert' })
  // A normal turn: fresh, appends the system prompt, no --resume yet.
  await session.prompt('go')
  assert.ok(!captured.includes('--resume'))
  assert.ok(captured.includes('--append-system-prompt'))
  // A chat message resumes the captured session and skips the redundant system append.
  await session.prompt('also add dark mode', { resume: true })
  assert.equal(captured[captured.indexOf('--resume') + 1], 'sess-1')
  assert.ok(!captured.includes('--append-system-prompt'))
})

test('ClaudeCodeSession seeds a given session id so the opening prompt resumes it (#720)', async () => {
  let captured: string[] = []
  const spawn: SpawnLike = (_cmd, args) => {
    captured = [...args]
    return fakeSpawn([JSON.stringify({ type: 'result', result: 'ok', session_id: 'sess-42' })])(_cmd, args, { cwd: '/ws', env: {} })
  }
  // A finished agent's session id is threaded in at start; the very first `resume` prompt continues it.
  const session = await new ClaudeCodeDriver({ spawn }).start({ cwd: '/ws', system: 'framing', resumeSessionId: 'sess-42' })
  await session.prompt('keep going', { resume: true })
  assert.equal(captured[captured.indexOf('--resume') + 1], 'sess-42')
  assert.ok(!captured.includes('--append-system-prompt')) // the resumed transcript already carries its framing
})

test('ClaudeCodeSession retries without --resume when the conversation is gone (#778)', async () => {
  const calls: string[][] = []
  const spawn: SpawnLike = (_cmd, args, options) => {
    calls.push([...args])
    // First attempt: the CLI refuses the id it was asked to resume. Second: a normal turn.
    return calls.length === 1
      ? fakeSpawn([], 1, 'No conversation found with session ID: sess-42')(_cmd, args, options)
      : fakeSpawn([JSON.stringify({ type: 'result', result: 'ok', session_id: 'sess-99' })])(_cmd, args, options)
  }
  const events: DriverEvent[] = []
  const session = await new ClaudeCodeDriver({ spawn }).start({ cwd: '/ws', system: 'framing', resumeSessionId: 'sess-42', onEvent: e => events.push(e) })

  const turn = await session.prompt('keep going', { resume: true })
  assert.equal(turn.text, 'ok') // the message lands rather than failing the session
  assert.equal(calls.length, 2)
  assert.equal(calls[0]?.[calls[0].indexOf('--resume') + 1], 'sess-42')
  // The retry is a fresh conversation, so it carries the system framing the resume skipped.
  assert.ok(!calls[1]?.includes('--resume'))
  assert.ok(calls[1]?.includes('--append-system-prompt'))
  assert.ok(events.some(e => e.type === 'notice' && /no longer available/.test(e.message)))

  // The dead id is dropped, so the next chat turn chains off the new conversation.
  await session.prompt('and again', { resume: true })
  assert.equal(calls[2]?.[calls[2].indexOf('--resume') + 1], 'sess-99')
})

test('ClaudeCodeSession does not retry a turn that failed for any other reason (#778)', async () => {
  const calls: string[][] = []
  const spawn: SpawnLike = (_cmd, args, options) => {
    calls.push([...args])
    return fakeSpawn([], 1, 'boom')(_cmd, args, options)
  }
  const session = await new ClaudeCodeDriver({ spawn }).start({ cwd: '/ws', system: 'framing', resumeSessionId: 'sess-42' })
  await assert.rejects(session.prompt('keep going', { resume: true }), /boom/)
  assert.equal(calls.length, 1)
})

test('ClaudeCodeSession runs a fresh turn when resume is asked with no prior session (#714)', async () => {
  let captured: string[] = []
  const spawn: SpawnLike = (_cmd, args) => {
    captured = [...args]
    return fakeSpawn([JSON.stringify({ type: 'result', result: 'ok' })])(_cmd, args, { cwd: '/ws', env: {} })
  }
  const session = await new ClaudeCodeDriver({ spawn }).start({ cwd: '/ws', system: 'framing' })
  await session.prompt('hi', { resume: true })
  assert.ok(!captured.includes('--resume'))
  assert.ok(captured.includes('--append-system-prompt'))
})

test('StreamJsonParser surfaces the rate-limit telemetry the agent emits per turn (#517)', () => {
  const p = new StreamJsonParser()
  // Real payload shape, captured from `claude -p --output-format stream-json`.
  const events = p.push(
    JSON.stringify({
      type: 'rate_limit_event',
      rate_limit_info: {
        status: 'allowed',
        resetsAt: 1784079000,
        rateLimitType: 'five_hour',
        overageStatus: 'rejected',
        isUsingOverage: false,
      },
      session_id: 'sess-1',
    }),
  )
  assert.deepEqual(events, [
    // The first sighting of the id announces it (#1322)…
    { type: 'session', sessionId: 'sess-1' },
    // …and the telemetry converts, seconds in, millis out.
    { type: 'rate-limit', limit: { status: 'allowed', window: 'five_hour', resetsAt: 1784079000_000 } },
  ])
  // Telemetry must not disturb the turn itself.
  assert.deepEqual(p.result(), { text: '', sessionId: 'sess-1' })
})

test('StreamJsonParser passes through rate-limit values it has never seen (#517)', () => {
  const p = new StreamJsonParser()
  // We have only ever observed status=allowed / window=five_hour. An unknown
  // value is the signal we are capturing for, so it must not be dropped.
  const events = p.push(
    JSON.stringify({
      type: 'rate_limit_event',
      rate_limit_info: { status: 'allowed_warning', resetsAt: 1784079000, rateLimitType: 'seven_day_opus' },
    }),
  )
  assert.deepEqual(events, [
    { type: 'rate-limit', limit: { status: 'allowed_warning', window: 'seven_day_opus', resetsAt: 1784079000_000 } },
  ])
})

test('StreamJsonParser stays silent on a malformed rate_limit_event (#517)', () => {
  const p = new StreamJsonParser()
  // Reporting a bogus reset time is worse than reporting nothing.
  assert.deepEqual(p.push(JSON.stringify({ type: 'rate_limit_event' })), [])
  assert.deepEqual(p.push(JSON.stringify({ type: 'rate_limit_event', rate_limit_info: null })), [])
  assert.deepEqual(
    p.push(JSON.stringify({ type: 'rate_limit_event', rate_limit_info: { status: 'allowed', rateLimitType: 'five_hour' } })),
    [],
  )
  assert.deepEqual(
    p.push(JSON.stringify({ type: 'rate_limit_event', rate_limit_info: { status: 'allowed', rateLimitType: 'five_hour', resetsAt: 'soon' } })),
    [],
  )
})

test('a session that keeps a log names its diary in the agent environment; one without does not', async () => {
  const { mkdtemp, rm } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const dir = await mkdtemp(join(tmpdir(), 'claude-diary-env-'))
  try {
    const seen: NodeJS.ProcessEnv[] = []
    const spawn: SpawnLike = (cmd, args, opts) => {
      seen.push(opts.env)
      return fakeSpawn([JSON.stringify({ type: 'result', result: 'ok' })])(cmd, args, opts)
    }
    const driver = new ClaudeCodeDriver({ spawn, env: { KEEP: '1' } })
    const logged = await driver.start({ cwd: dir, log: { dir, card: { id: 'r1' } } })
    await logged.prompt('go')
    await logged.log!.settled()
    await (await driver.start({ cwd: dir })).prompt('go')
    assert.deepEqual(seen[0], { KEEP: '1', AGENT_DIARY: join(dir, 'r1.jsonl') })
    assert.deepEqual(seen[1], { KEEP: '1' })
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

/** Runs one turn on a Claude Code driver with `opts`, and answers the arguments and the environment Claude Code was spawned with. */
async function spawnedWith(opts: ConstructorParameters<typeof ClaudeCodeDriver>[0]): Promise<{ args: string[]; env: NodeJS.ProcessEnv }> {
  let seen: { args: string[]; env: NodeJS.ProcessEnv } | undefined
  const spawn: SpawnLike = (cmd, args, spawnOpts) => ((seen = { args: [...args], env: spawnOpts.env ?? {} }), fakeSpawn([JSON.stringify({ type: 'result', result: 'ok' })])(cmd, args, spawnOpts))
  const session = await new ClaudeCodeDriver({ ...opts, spawn }).start({ cwd: '/ws' })
  await session.prompt('go')
  return seen!
}

test('ClaudeCodeDriver turns each part of the person\'s setup that is off into Claude Code\'s own switch, and only those', async () => {
  const none = await spawnedWith({ env: {} })
  assert.equal(none.env['CLAUDE_CODE_DISABLE_AUTO_MEMORY'], undefined, 'no setup given: Claude Code as it is')
  assert.ok(!none.args.includes('--setting-sources'))
  const off = await spawnedWith({ env: {}, extraArgs: ['--x'], personal: { memory: false, connectors: false, skills: false } })
  assert.equal(off.env['CLAUDE_CODE_DISABLE_AUTO_MEMORY'], '1')
  assert.equal(off.env['ENABLE_CLAUDEAI_MCP_SERVERS'], 'false')
  assert.deepEqual(off.args.slice(-3), ['--setting-sources', 'project,local', '--x'], 'the caller\'s own extra args kept')
  const memory = await spawnedWith({ env: {}, personal: { memory: true, connectors: false, skills: false } })
  assert.equal(memory.env['CLAUDE_CODE_DISABLE_AUTO_MEMORY'], undefined)
  assert.equal(memory.env['ENABLE_CLAUDEAI_MCP_SERVERS'], 'false')
  const connectors = await spawnedWith({ env: {}, personal: { memory: false, connectors: true, skills: false } })
  assert.equal(connectors.env['CLAUDE_CODE_DISABLE_AUTO_MEMORY'], '1')
  assert.equal(connectors.env['ENABLE_CLAUDEAI_MCP_SERVERS'], undefined)
  const skills = await spawnedWith({ env: {}, personal: { memory: false, connectors: false, skills: true } })
  assert.ok(!skills.args.includes('--setting-sources'))
})

test('claudeCodeReady asks claude: its JSON login flag, the login command, the install page', async () => {
  const answer = (auth: string) => (_bin: string, args: readonly string[]) => Promise.resolve({ ok: true, output: args[0] === '--version' ? '2.1.283' : auth })
  assert.deepEqual(await claudeCodeReady({ isRoot: () => false, probe: answer('{"loggedIn": true}') }), { problems: [], warnings: [] })
  assert.match((await claudeCodeReady({ isRoot: () => false, probe: answer('{"loggedIn": false}') })).problems[0]!, /claude auth login/)
  const missing = await claudeCodeReady({ isRoot: () => false, probe: () => Promise.resolve({ ok: false, output: '' }) })
  assert.match(missing.problems[0]!, /`claude` not found.*claude\.com\/claude-code/)
})
