import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { nodeGitRunner, DATA_BRANCH } from '@gemstack/agent-data'
import { runCli, USAGE, DEFAULT_LIMIT } from './cli.js'
import { RUNS_DIR } from './names.js'

const git = nodeGitRunner()
const RETRIED_RM = { recursive: true, force: true, maxRetries: 10 } as const

const R1 = '2026-07-04T00-00-00-000Z'
const R2 = '2026-07-05T00-00-00-000Z'
const R3 = '2026-07-06T00-00-00-000Z'
const card = (id: string, over: Record<string, unknown> = {}) => ({ id, startedAt: id.replace(/-(\d\d)-(\d\d)-(\d\d\d)Z$/, ':$1:$2.$3Z'), status: 'done', ...over })

/** The runs on the branch: two people, three runs, one diary with the writer's lines among the agent's. */
const RUNS: Record<string, string> = {
  [`a@a/${R1}.json`]: JSON.stringify(card(R1, { intent: 'first try', ticket: 'tickets/2026-07-01_fix.md', branch: 'agent-r1', status: 'failed', caller: { pid: 1, host: 'laptop' } })),
  [`a@a/${R1}.jsonl`]: [
    '{"kind":"session","driver":"claude-code"}',
    '{"kind":"said","text":"Reading the ticket."}',
    '{"kind":"action","label":"Bash"}',
    '{"kind":"result","text":"Could not finish."}',
    '{"kind":"cost","usd":0.5,"inputTokens":9}',
    '{"kind":"ended","status":"failed","detail":"API 500"}',
    '',
  ].join('\n'),
  [`b@b/${R2}.json`]: JSON.stringify(card(R2, { intent: 'second try', ticket: 'tickets/2026-07-01_fix.md', branch: 'agent-r2', pr: { number: 3, url: 'https://x/pull/3' }, cost: 1.25 })),
  [`b@b/${R2}.jsonl`]: '{"kind":"ended","status":"done"}\n',
  [`b@b/${R3}.json`]: JSON.stringify(card(R3, { intent: 'unrelated', branch: 'agent-r3' })),
  'b@b/notes.md': 'not a run\n',
}

/** A bare origin with an `agent-data` branch holding `runs`, plus N clones acting as agents. */
async function rig(clones: number, runs: Record<string, string> = RUNS) {
  const bare = await realpath(await mkdtemp(join(tmpdir(), 'logs-cli-bare-')))
  await git(['init', '--bare', '-b', 'main', bare], bare)
  const seed = await realpath(await mkdtemp(join(tmpdir(), 'logs-cli-seed-')))
  await git(['clone', bare, seed], seed)
  await git(['config', 'user.email', 's@s'], seed)
  await git(['config', 'user.name', 's'], seed)
  await writeFile(join(seed, 'README.md'), '# t\n')
  await git(['add', '-A'], seed)
  await git(['commit', '-m', 'init'], seed)
  await git(['push', 'origin', 'main'], seed)
  const commit = (await git(['commit-tree', '4b825dc642cb6eb9a060e54bf8d69288fbee4904', '-m', 'create the agent-data branch'], seed)).trim()
  await git(['checkout', '-B', DATA_BRANCH, commit], seed)
  for (const [rel, content] of Object.entries(runs)) {
    await mkdir(join(seed, RUNS_DIR, rel, '..'), { recursive: true })
    await writeFile(join(seed, RUNS_DIR, rel), content)
  }
  if (Object.keys(runs).length) {
    await git(['add', '-A'], seed)
    await git(['commit', '-m', 'seed'], seed)
  }
  await git(['push', 'origin', DATA_BRANCH], seed)
  const agents: string[] = []
  for (let i = 0; i < clones; i++) {
    const parent = await realpath(await mkdtemp(join(tmpdir(), `logs-cli-agent${i}-`)))
    const clone = join(parent, 'clone')
    await git(['clone', bare, clone], parent)
    await git(['checkout', '-b', `agent-a${i}`], clone)
    agents.push(clone)
  }
  const cleanup = async () => {
    for (const dir of [bare, seed, ...agents.map(a => join(a, '..'))]) await rm(dir, RETRIED_RM)
  }
  return { bare, seed, agents, cleanup }
}

/** Run one command, capturing the contract: parsed stdout, stderr lines, exit code. */
async function run(cwd: string, argv: string[]) {
  const out: string[] = []
  const err: string[] = []
  const code = await runCli(argv, { cwd, stdout: line => out.push(line), stderr: line => err.push(line) })
  return { code, json: out.length ? JSON.parse(out.join('\n')) : undefined, stderr: err.join('\n') }
}

test('the bare command lists every person\'s runs off origin, newest first, the package\'s fields only; --ticket, --branch and --limit narrow it', async () => {
  const { agents, cleanup } = await rig(1)
  const [a] = agents
  try {
    const all = await run(a!, [])
    assert.equal(all.code, 0)
    assert.deepEqual(
      all.json.map((c: { id: string }) => c.id),
      [R3, R2, R1],
    )
    assert.deepEqual(all.json[2], { ...card(R1), intent: 'first try', ticket: 'tickets/2026-07-01_fix.md', branch: 'agent-r1', status: 'failed' }, 'caller is the writer\'s, not printed')
    // By the ticket's file name, or the path a queue entry links to.
    const byFile = await run(a!, ['--ticket', '2026-07-01_fix.md'])
    assert.deepEqual(byFile.json.map((c: { id: string; status: string }) => [c.id, c.status]), [[R2, 'done'], [R1, 'failed']])
    assert.deepEqual((await run(a!, ['--ticket', 'tickets/2026-07-01_fix.md'])).json.map((c: { id: string }) => c.id), [R2, R1])
    assert.deepEqual((await run(a!, ['--ticket', 'other.md'])).json, [])
    assert.deepEqual((await run(a!, ['--branch', 'agent-r3'])).json.map((c: { id: string }) => c.id), [R3])
    assert.deepEqual((await run(a!, ['--limit', '1'])).json.map((c: { id: string }) => c.id), [R3])
    assert.deepEqual((await run(a!, ['--ticket', '2026-07-01_fix.md', '--limit', '1'])).json.map((c: { id: string }) => c.id), [R2], 'the cap counts matches')
    // Nothing lands locally: the agent's clone holds no copy of the branch.
    await assert.rejects(git(['rev-parse', '--verify', DATA_BRANCH], a!))
    assert.equal((await git(['status', '--porcelain'], a!)).trim(), '')
  } finally {
    await cleanup()
  }
})

test('the bare command caps at the default limit', async () => {
  const many: Record<string, string> = {}
  for (let i = 0; i < DEFAULT_LIMIT + 5; i++) {
    const id = `2026-01-01T00-00-${String(i).padStart(2, '0')}-000Z`
    many[`p@p/${id}.json`] = JSON.stringify(card(id))
  }
  const { agents, cleanup } = await rig(1, many)
  try {
    assert.equal((await run(agents[0]!, [])).json.length, DEFAULT_LIMIT)
    assert.equal((await run(agents[0]!, ['--limit', '100'])).json.length, DEFAULT_LIMIT + 5)
  } finally {
    await cleanup()
  }
})

test('show prints the card with the agent\'s lines of the diary, never the writer\'s; an unknown run is refused', async () => {
  const { agents, cleanup } = await rig(1)
  const [a] = agents
  try {
    const shown = await run(a!, ['show', R1])
    assert.equal(shown.code, 0)
    assert.deepEqual(shown.json, {
      ...card(R1),
      intent: 'first try',
      ticket: 'tickets/2026-07-01_fix.md',
      branch: 'agent-r1',
      status: 'failed',
      diary: [
        { kind: 'said', text: 'Reading the ticket.' },
        { kind: 'result', text: 'Could not finish.' },
        { kind: 'cost', usd: 0.5, inputTokens: 9 },
        { kind: 'ended', status: 'failed', detail: 'API 500' },
      ],
    })
    assert.deepEqual((await run(a!, ['show', R3])).json.diary, [], 'no diary file: no lines')
    const missing = await run(a!, ['show', '2026-01-01T00-00-00-000Z'])
    assert.equal(missing.code, 1)
    assert.deepEqual(missing.json, { ok: false, reason: 'no-run', id: '2026-01-01T00-00-00-000Z' })
    assert.match(missing.stderr, /no run is named/)
  } finally {
    await cleanup()
  }
})

test('usage: an unknown command, a stray argument, a bad limit and an unsafe id', async () => {
  const { agents, cleanup } = await rig(1, {})
  const [a] = agents
  try {
    const unknown = await run(a!, ['dance'])
    assert.equal(unknown.code, 2)
    assert.equal(unknown.json, undefined)
    assert.equal(unknown.stderr, USAGE)
    assert.equal((await run(a!, ['--limit', '0'])).code, 2)
    assert.equal((await run(a!, ['--limit', 'many'])).code, 2)
    assert.equal((await run(a!, ['--nope'])).code, 2)
    assert.equal((await run(a!, ['show'])).code, 2)
    assert.equal((await run(a!, ['show', 'a', 'b'])).code, 2)
    assert.equal((await run(a!, ['show', '../escape'])).code, 2)
    assert.deepEqual((await run(a!, [])).json, [], 'no runs yet reads as none')
  } finally {
    await cleanup()
  }
})

test('a repository with no remote reads its local branch; outside a repository is a refusal', async () => {
  const solo = await realpath(await mkdtemp(join(tmpdir(), 'logs-cli-solo-')))
  try {
    await git(['init', '-b', 'main'], solo)
    await git(['config', 'user.email', 's@s'], solo)
    await git(['config', 'user.name', 's'], solo)
    await writeFile(join(solo, 'README.md'), '# t\n')
    await git(['add', '-A'], solo)
    await git(['commit', '-m', 'init'], solo)
    const commit = (await git(['commit-tree', '4b825dc642cb6eb9a060e54bf8d69288fbee4904', '-m', 'create the agent-data branch'], solo)).trim()
    await git(['branch', DATA_BRANCH, commit], solo)
    assert.deepEqual((await run(solo, [])).json, [])
    const outside = await run(tmpdir(), [])
    assert.equal(outside.code, 1)
    assert.deepEqual(outside.json, { ok: false, reason: 'not-a-repo' })
  } finally {
    await rm(solo, RETRIED_RM)
  }
})
