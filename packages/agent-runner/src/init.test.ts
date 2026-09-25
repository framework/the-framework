import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse } from 'yaml'
import { HOOK_LINES, initHooks, writeHookLines } from './init.js'

// `init` against real files: the lines written into a fresh file, merged into a person's, and
// nothing written where the dashboard has no directory.

async function project(dashboard: boolean, hooks?: string): Promise<string> {
  const repo = await realpath(await mkdtemp(join(tmpdir(), 'agent-runner-init-')))
  if (dashboard) await mkdir(join(repo, '.the-framework'))
  if (hooks !== undefined) await writeFile(join(repo, '.the-framework', 'hooks.yml'), hooks)
  return repo
}

const hooksOf = async (repo: string): Promise<string> => readFile(join(repo, '.the-framework', 'hooks.yml'), 'utf8')

test('a project the dashboard knows, with no hooks file, gets every line', async () => {
  const repo = await project(true)
  try {
    const outcome = await initHooks(repo)
    assert.deepEqual(outcome, { ok: true, file: join(repo, '.the-framework', 'hooks.yml'), added: ['start', 'resume', 'check'], kept: [] })
    assert.deepEqual(parse(await hooksOf(repo)), HOOK_LINES)
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})

// Another tool's lines, a list among them, written through the same writer.
const LINES = { open: ['npx a-tool start'], close: ['npx a-tool stop'], start: HOOK_LINES['start']!, resume: HOOK_LINES['resume']!, check: HOOK_LINES['check']! }

test("a person's file keeps its lines and its comments; a list gains the tool's line; a second init writes nothing", async () => {
  const mine = '# my hooks\nopen:\n  - echo hello\nstart: ./my-start.sh "$PROMPT"\n'
  const repo = await project(true, mine)
  try {
    const outcome = await writeHookLines(repo, LINES)
    assert.ok(outcome.ok)
    assert.deepEqual(outcome.added, ['open', 'close', 'resume', 'check'])
    assert.deepEqual(outcome.kept, ['start'])
    const written = await hooksOf(repo)
    assert.match(written, /^# my hooks\n/)
    const data = parse(written) as Record<string, unknown>
    assert.deepEqual(data['open'], ['echo hello', 'npx a-tool start'])
    assert.equal(data['start'], './my-start.sh "$PROMPT"')
    assert.equal(data['resume'], HOOK_LINES['resume'])

    const again = await writeHookLines(repo, LINES)
    assert.deepEqual(again, { ok: true, file: outcome.file, added: [], kept: ['start'] })
    assert.equal(await hooksOf(repo), written)
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})

test('no dashboard directory, or a file that is not YAML, is refused and nothing is written', async () => {
  const bare = await project(false)
  const broken = await project(true, 'start: [\n')
  try {
    const none = await initHooks(bare)
    assert.equal(none.ok, false)
    assert.equal(!none.ok && none.reason, 'no-dashboard')
    await assert.rejects(readFile(join(bare, '.the-framework', 'hooks.yml')))

    const unreadable = await initHooks(broken)
    assert.equal(!unreadable.ok && unreadable.reason, 'unreadable')
    assert.equal(await hooksOf(broken), 'start: [\n')
  } finally {
    await rm(bare, { recursive: true, force: true })
    await rm(broken, { recursive: true, force: true })
  }
})
