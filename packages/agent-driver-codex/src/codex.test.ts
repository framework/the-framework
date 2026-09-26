import { strict as assert } from 'node:assert'
import { execFileSync } from 'node:child_process'
import { lstat, mkdir, mkdtemp, readFile, readlink, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { Readable, Writable } from 'node:stream'
import { CodexDriver, CodexJsonParser, codexReady, defaultCodexHome, parseCodexUsage } from './codex.js'
import type { SpawnLike, SpawnedProcess, Driver, DriverEvent } from 'agent-driver'

/** A real codex-cli 0.144.4 run, verbatim: "Create a file hello.txt containing exactly: hi". */
const REAL_RUN = [
  JSON.stringify({ type: 'thread.started', thread_id: '019f660b-bf69-7d62-a96c-34aad1f083db' }),
  JSON.stringify({ type: 'turn.started' }),
  JSON.stringify({ type: 'item.completed', item: { id: 'item_0', type: 'agent_message', text: 'I’ll create `hello.txt`.' } }),
  JSON.stringify({ type: 'item.started', item: { id: 'item_1', type: 'file_change', status: 'in_progress' } }),
  JSON.stringify({ type: 'item.completed', item: { id: 'item_1', type: 'file_change', status: 'completed' } }),
  JSON.stringify({ type: 'item.completed', item: { id: 'item_2', type: 'agent_message', text: 'Created hello.txt' } }),
  JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 12210, cached_input_tokens: 9984, output_tokens: 5 } }),
]

test('CodexJsonParser takes the last message as the turn (#539)', () => {
  const p = new CodexJsonParser()
  for (const line of REAL_RUN) p.push(line)
  // Codex narrates as it goes; the last message is its answer, not the first.
  const turn = p.result()
  assert.equal(turn.text, 'Created hello.txt')
  assert.equal(turn.sessionId, '019f660b-bf69-7d62-a96c-34aad1f083db')
})

test('CodexJsonParser announces the session at once, streams text and surfaces tool kinds only (#539)', () => {
  const p = new CodexJsonParser()
  const events = REAL_RUN.flatMap(line => p.push(line))
  assert.deepEqual(events, [
    { type: 'session', sessionId: '019f660b-bf69-7d62-a96c-34aad1f083db' },
    { type: 'text', text: 'I’ll create `hello.txt`.' },
    { type: 'action', label: 'file_change' },
    { type: 'text', text: 'Created hello.txt' },
  ])
})

test('CodexJsonParser reports the tokens but never a price (#540)', () => {
  const p = new CodexJsonParser()
  for (const line of REAL_RUN) p.push(line)
  const usage = p.result().usage
  // The tokens are real and reported; `costUsd: 0` would read as free, so it is absent.
  assert.deepEqual(usage, {
    inputTokens: 2226, // 12210 total - 9984 cached
    outputTokens: 5,
    cacheReadTokens: 9984,
    cacheCreationTokens: 0,
  })
  assert.equal(usage?.costUsd, undefined)
  assert.equal('costUsd' in usage!, false)
})

test('parseCodexUsage splits the cached tokens out of the inclusive input total (#540)', () => {
  // Verbatim from codex-cli 0.144.4. `input_tokens` is the whole input, cached
  // included: repeating one prompt held it at 12218 while cached rose to 12032.
  const usage = parseCodexUsage({ input_tokens: 12218, cached_input_tokens: 12032, output_tokens: 6, reasoning_output_tokens: 0 })
  assert.deepEqual(usage, {
    inputTokens: 186,
    outputTokens: 6,
    cacheReadTokens: 12032,
    cacheCreationTokens: 0,
  })
})

test('parseCodexUsage does not double-count reasoning tokens (#540)', () => {
  // reasoning_output_tokens is a subset of output_tokens, as cached_input_tokens
  // is of input_tokens — adding it would inflate the count.
  const usage = parseCodexUsage({ input_tokens: 100, cached_input_tokens: 0, output_tokens: 500, reasoning_output_tokens: 400 })
  assert.equal(usage?.outputTokens, 500)
})

test('parseCodexUsage survives a missing or malformed payload (#540)', () => {
  assert.equal(parseCodexUsage(undefined), undefined)
  assert.equal(parseCodexUsage('nonsense'), undefined)
  // Absent fields read as 0 rather than NaN, and a nonsense cache count can never
  // push the uncached input negative.
  assert.deepEqual(parseCodexUsage({}), { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 })
  assert.deepEqual(parseCodexUsage({ input_tokens: 10, cached_input_tokens: 999 }), {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 10,
    cacheCreationTokens: 0,
  })
})

test('CodexJsonParser ignores noise that is not an event (#539)', () => {
  const p = new CodexJsonParser()
  assert.deepEqual(p.push('Reading additional input from stdin...'), [])
  assert.deepEqual(p.push(''), [])
  // `null` is valid JSON, so it survives the parse and used to throw on the first field read —
  // inside a readline handler, which takes the daemon and every live agent with it.
  assert.deepEqual(p.push('null'), [])
  assert.deepEqual(p.push(JSON.stringify({ type: 'turn.started' })), [])
  assert.deepEqual(p.result(), { text: '' })
})

/** A fake process that emits the given lines then closes. */
function fakeSpawn(lines: string[], onSpawn?: (args: readonly string[], stdin: string) => void, code = 0): SpawnLike {
  return (_command, args) => {
    const stdout = Readable.from([lines.map(l => l + '\n').join('')])
    let written = ''
    const stdin = new Writable({
      write: (chunk, _e, cb) => {
        written += String(chunk)
        cb()
      },
    })
    const proc: SpawnedProcess = {
      stdout,
      stderr: Readable.from([]),
      stdin,
      on(event, listener) {
        if (event === 'close') stdout.on('end', () => (onSpawn?.(args, written), (listener as (c: number | null) => void)(code)))
        return proc
      },
      kill: () => undefined,
    }
    return proc
  }
}

test('CodexDriver runs a prompt through the CLI and returns the turn (#539)', async () => {
  const events: DriverEvent[] = []
  const driver = new CodexDriver({ spawn: fakeSpawn(REAL_RUN) })
  const session = await driver.start({ cwd: '/ws', onEvent: e => events.push(e) })
  const turn = await session.prompt('build it')
  assert.equal(turn.text, 'Created hello.txt')
  assert.equal(turn.sessionId, '019f660b-bf69-7d62-a96c-34aad1f083db')
  assert.ok(events.some(e => e.type === 'action' && e.label === 'file_change'))
  assert.ok(events.some(e => e.type === 'result'))
})

test('a Codex turn that fails keeps its session id on the log: a later resume continues the same thread', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'codex-log-'))
  try {
    const driver = new CodexDriver({ spawn: fakeSpawn(REAL_RUN.slice(0, 3), undefined, 1) })
    const session = await driver.start({ cwd: dir, log: { dir, card: { id: 'r1' } } })
    await assert.rejects(session.prompt('build it'), /exited \(1\)/)
    await session.log!.settled()
    assert.equal(session.log!.card.caller?.['sessionId'], '019f660b-bf69-7d62-a96c-34aad1f083db')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('CodexDriver runs sandboxed in the workspace, never with the bypass (#539)', async () => {
  let seen: readonly string[] = []
  const driver = new CodexDriver({ spawn: fakeSpawn(REAL_RUN, args => (seen = args)) })
  const session = await driver.start({ cwd: '/ws' })
  await session.prompt('go')
  assert.deepEqual([...seen], ['exec', '--json', '--skip-git-repo-check', '--sandbox', 'workspace-write', '-C', '/ws'])
  // The agent may edit its workspace and nothing else.
  assert.ok(!seen.includes('--dangerously-bypass-approvals-and-sandbox'))
  // Codex refuses to run outside a git repo, and a fresh workspace isn't one yet.
  assert.ok(seen.includes('--skip-git-repo-check'))
})

test('CodexDriver makes the git dir writable, so a plain checkout can commit (#1747)', async () => {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'codex-git-')))
  try {
    execFileSync('git', ['init', '-q'], { cwd: dir })
    let seen: readonly string[] = []
    const driver = new CodexDriver({ spawn: fakeSpawn(REAL_RUN, args => (seen = args)) })
    const session = await driver.start({ cwd: dir })
    await session.prompt('go')
    // `workspace-write` keeps a root `.git/` read-only; without this the commit fails on `.git/index.lock`.
    assert.deepEqual([...seen], [
      'exec', '--json', '--skip-git-repo-check', '--sandbox', 'workspace-write', '-C', dir,
      '-c', `sandbox_workspace_write.writable_roots=["${join(dir, '.git')}"]`,
    ])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('CodexDriver widens no read-only sandbox, even in a repository (#1747)', async () => {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'codex-git-')))
  try {
    execFileSync('git', ['init', '-q'], { cwd: dir })
    let seen: readonly string[] = []
    const driver = new CodexDriver({ sandbox: 'read-only', spawn: fakeSpawn(REAL_RUN, args => (seen = args)) })
    const session = await driver.start({ cwd: dir })
    await session.prompt('go')
    assert.ok(!seen.includes('-c'))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('CodexDriver sends the prompt over stdin, not as an argument (#539)', async () => {
  let stdin = ''
  let seen: readonly string[] = []
  const driver = new CodexDriver({ spawn: fakeSpawn(REAL_RUN, (args, written) => ((seen = args), (stdin = written))) })
  const session = await driver.start({ cwd: '/ws' })
  await session.prompt('a very long prompt')
  // Over stdin so a long prompt never hits the arg-length limit.
  assert.equal(stdin, 'a very long prompt')
  assert.ok(!seen.includes('a very long prompt'))
})

test('CodexDriver prepends the framing, since Codex has no system-prompt flag (#539)', async () => {
  let stdin = ''
  const driver = new CodexDriver({ spawn: fakeSpawn(REAL_RUN, (_a, written) => (stdin = written)) })
  const session = await driver.start({ cwd: '/ws', system: 'You are careful.' })
  await session.prompt('do the thing', { system: 'Also: be brief.' })
  assert.equal(stdin, 'You are careful.\n\nAlso: be brief.\n\ndo the thing')
})

test('CodexDriver continues its conversation on a resume prompt, and only then', async () => {
  const seen: Array<{ args: readonly string[]; stdin: string }> = []
  const driver = new CodexDriver({ spawn: fakeSpawn(REAL_RUN, (args, stdin) => seen.push({ args, stdin })) })
  const session = await driver.start({ cwd: '/ws', system: 'FRAMING', model: 'gpt-5' })
  await session.prompt('build it', { resume: true })
  await session.prompt('and the tests?', { resume: true })
  await session.prompt('something new')
  const id = '019f660b-bf69-7d62-a96c-34aad1f083db'
  assert.deepEqual([...seen[0]!.args].slice(0, 2), ['exec', '--json'], 'no turn yet: nothing to resume, a fresh conversation')
  assert.deepEqual([...seen[1]!.args], ['exec', 'resume', id, '-', '--json', '--skip-git-repo-check', '-c', 'sandbox_mode="workspace-write"', '-m', 'gpt-5'])
  assert.equal(seen[1]!.stdin, 'and the tests?', 'the resumed conversation already carries its framing')
  assert.equal(seen[0]!.stdin, 'FRAMING\n\nbuild it')
  assert.deepEqual([...seen[2]!.args].slice(0, 2), ['exec', '--json'], 'a prompt that does not ask to resume starts fresh')
})

test('CodexDriver resumes the conversation a session was started for, under the sandbox given', async () => {
  let seen: readonly string[] = []
  const driver = new CodexDriver({ sandbox: 'danger-full-access', spawn: fakeSpawn(REAL_RUN, args => (seen = args)) })
  const session = await driver.start({ cwd: '/ws', resumeSessionId: 'thread-1' })
  await session.prompt('go on', { resume: true })
  assert.deepEqual([...seen], ['exec', 'resume', 'thread-1', '-', '--json', '--skip-git-repo-check', '-c', 'sandbox_mode="danger-full-access"'])
})

test('CodexDriver passes the model through (#539)', async () => {
  let seen: readonly string[] = []
  const driver = new CodexDriver({ spawn: fakeSpawn(REAL_RUN, args => (seen = args)) })
  const session = await driver.start({ cwd: '/ws', model: 'gpt-5-codex' })
  await session.prompt('go')
  assert.ok(seen.includes('-m') && seen.includes('gpt-5-codex'))
})

test('CodexDriver cannot report a quota, so it says so by omission (#539)', () => {
  // The seam is optional precisely for this: no readQuota means no consumption
  // limits for Codex, rather than a made-up number.
  const driver: Driver = new CodexDriver()
  assert.equal(driver.readQuota, undefined)
})

test('CodexDriver fails the turn on a non-zero exit (#539)', async () => {
  const driver = new CodexDriver({ spawn: fakeSpawn(REAL_RUN, undefined, 1) })
  const session = await driver.start({ cwd: '/ws' })
  // A crash mid-build must not pass as a result, even though text streamed first.
  await assert.rejects(() => session.prompt('go'), /codex exited \(1\)/)
})

/** Runs one turn on a Codex driver with `opts`, and answers the arguments and the environment Codex was spawned with. */
async function spawnedWith(opts: ConstructorParameters<typeof CodexDriver>[0]): Promise<{ args: readonly string[]; env: NodeJS.ProcessEnv }> {
  let seen: { args: readonly string[]; env: NodeJS.ProcessEnv } | undefined
  const inner = fakeSpawn(REAL_RUN)
  const spawn: SpawnLike = (command, args, spawnOpts) => ((seen = { args, env: spawnOpts.env ?? {} }), inner(command, args, spawnOpts))
  const session = await new CodexDriver({ ...opts, spawn }).start({ cwd: '/ws' })
  await session.prompt('go')
  return seen!
}

test('CodexDriver given no setup parts runs Codex as it is, in the person\'s own home', async () => {
  const { args, env } = await spawnedWith({ env: { PATH: '/bin' } })
  assert.ok(!args.some(arg => arg.startsWith('features.')))
  assert.equal(env['CODEX_HOME'], undefined)
})

test('CodexDriver turns memory and connectors off with Codex\'s own feature switches, each alone', async () => {
  const both = await spawnedWith({ env: {}, personal: { memory: false, connectors: false, skills: true } })
  assert.deepEqual(both.args.filter((_, i, all) => all[i - 1] === '-c' && all[i]!.startsWith('features.')), ['features.memories=false', 'features.apps=false', 'features.plugins=false'])
  assert.equal(both.env['CODEX_HOME'], undefined, 'skills on: the person\'s own home')
  const memoryOn = await spawnedWith({ env: {}, personal: { memory: true, connectors: false, skills: true } })
  assert.ok(!memoryOn.args.includes('features.memories=false'))
  assert.ok(memoryOn.args.includes('features.plugins=false'))
  const connectorsOn = await spawnedWith({ env: {}, personal: { memory: false, connectors: true, skills: true } })
  assert.ok(connectorsOn.args.includes('features.memories=false'))
  assert.ok(!connectorsOn.args.includes('features.apps=false') && !connectorsOn.args.includes('features.plugins=false'))
})

test('CodexDriver with skills off runs from a kept home that holds only a link to the person\'s login', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'codex-home-'))
  try {
    const personal = join(dir, 'personal')
    const home = join(dir, 'state', 'codex-home')
    await mkdir(personal)
    await writeFile(join(personal, 'auth.json'), '{}')
    const first = await spawnedWith({ env: { CODEX_HOME: personal }, codexHome: home, personal: { memory: true, connectors: true, skills: false } })
    assert.equal(first.env['CODEX_HOME'], home)
    assert.ok((await lstat(join(home, 'auth.json'))).isSymbolicLink())
    assert.equal(await readlink(join(home, 'auth.json')), join(personal, 'auth.json'))
    // What Codex saved there (its conversations) stays for the resume; a link pointing elsewhere is put back.
    await writeFile(join(home, 'session.jsonl'), 'kept')
    await rm(join(home, 'auth.json'))
    await writeFile(join(home, 'auth.json'), 'a stale copy')
    await spawnedWith({ env: { CODEX_HOME: personal }, codexHome: home, personal: { memory: true, connectors: true, skills: false } })
    assert.equal(await readlink(join(home, 'auth.json')), join(personal, 'auth.json'))
    assert.equal(await readFile(join(home, 'session.jsonl'), 'utf8'), 'kept')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('the kept Codex home is under the state directory', () => {
  assert.equal(defaultCodexHome({ XDG_STATE_HOME: '/state' }), '/state/agent-driver/codex-home')
})

test('codexReady asks codex, and warns about ~/.agents/skills only when skills are off and it holds some', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'agents-skills-'))
  try {
    const probed: string[] = []
    const probe = (bin: string, args: readonly string[]) => (probed.push(bin), Promise.resolve({ ok: true, output: args[0] === '--version' ? '0.144.4' : 'Logged in using ChatGPT' }))
    const base = { probe, isRoot: () => false, agentsSkills: dir }
    assert.deepEqual(await codexReady({ ...base, personal: { memory: false, connectors: false, skills: false } }), { problems: [], warnings: [] }, 'an empty folder')
    await mkdir(join(dir, 'my-skill'))
    const off = await codexReady({ ...base, personal: { memory: false, connectors: false, skills: false } })
    assert.deepEqual(off.problems, [])
    assert.equal(off.warnings.length, 1)
    assert.match(off.warnings[0]!, /no switch/)
    assert.ok(off.warnings[0]!.includes(dir))
    assert.deepEqual((await codexReady({ ...base, personal: { memory: false, connectors: false, skills: true } })).warnings, [], 'skills on: nothing to warn about')
    assert.deepEqual((await codexReady(base)).warnings, [], 'no setup given: Codex as it is')
    assert.ok(probed.every(bin => bin === 'codex'))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('codexReady reads "Not logged in" as no, also off stderr, and a missing codex points at its install', async () => {
  const out = await codexReady({ isRoot: () => false, probe: (_bin, args) => Promise.resolve(args[0] === '--version' ? { ok: true, output: '0.144.4' } : { ok: false, output: 'Not logged in' }) })
  assert.match(out.problems[0]!, /codex login/)
  const missing = await codexReady({ isRoot: () => false, probe: () => Promise.resolve({ ok: false, output: '' }) })
  assert.match(missing.problems[0]!, /`codex` not found.*openai\.com\/codex/)
})
