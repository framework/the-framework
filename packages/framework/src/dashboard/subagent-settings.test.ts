import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PROJECT_HOOKS_FILE } from '../project-hooks.js'
import { SUBAGENT_SETTINGS_FILE, subagentSettingsIn } from '../subagent-settings.js'
import { readSubagentSettings, setSubagentSettings } from './subagent-settings.js'
import type { ProjectSummary } from './projects.js'

// Settings → Subagents over real project folders: the line in each project's hooks file, the
// orchestration package's file at its root.

const LINE = 'subagents: npx orchestration settings "$SUBAGENTS"\n'

async function project(name: string, opts: { hooks?: string; settings?: string } = {}): Promise<ProjectSummary> {
  const path = await realpath(await mkdtemp(join(tmpdir(), `framework-subagents-${name}-`)))
  if (opts.hooks !== undefined) {
    await mkdir(join(path, '.the-framework'), { recursive: true })
    await writeFile(join(path, PROJECT_HOOKS_FILE), opts.hooks)
  }
  if (opts.settings !== undefined) {
    await mkdir(join(path, '.orchestration'), { recursive: true })
    await writeFile(join(path, SUBAGENT_SETTINGS_FILE), opts.settings)
  }
  return { id: name, name, path } as ProjectSummary
}

test('the settings in force: the first project with the line and a file that parses, in registry order; the count of projects with the line', async () => {
  const projects = [
    await project('unhooked', { settings: JSON.stringify({ atOnce: 9 }) }),
    await project('empty', { hooks: LINE }),
    await project('broken', { hooks: LINE, settings: '{ nope' }),
    await project('set', { hooks: LINE, settings: JSON.stringify({ hard: { driver: 'claude-code', model: 'opus' }, atOnce: 2 }) }),
    await project('later', { hooks: LINE, settings: JSON.stringify({ atOnce: 7 }) }),
  ]
  try {
    assert.deepEqual(await readSubagentSettings(projects), { settings: { hard: { driver: 'claude-code', model: 'opus' }, atOnce: 2 }, hooked: 4 })
    assert.deepEqual(await readSubagentSettings(projects.slice(0, 3)), { settings: {}, hooked: 2 })
    assert.deepEqual(await readSubagentSettings([]), { settings: {}, hooked: 0 })
  } finally {
    for (const p of projects) await rm(p.path, { recursive: true, force: true })
  }
})

test('a field not of the promised shape reads as unset', () => {
  assert.deepEqual(subagentSettingsIn({ simple: { driver: 'pi' }, hard: { driver: 'codex', model: ' ' }, atOnce: 0 }), { hard: { driver: 'codex' } })
  assert.deepEqual(subagentSettingsIn({ simple: 'opus', atOnce: 2.5 }), {})
  assert.deepEqual(subagentSettingsIn([]), {})
  assert.deepEqual(subagentSettingsIn({ simple: { driver: 'codex', model: ' gpt-5.5 ' }, atOnce: 6 }), { simple: { driver: 'codex', model: 'gpt-5.5' }, atOnce: 6 })
})

test('saving: every project with the line gets the settings whole and clean; a project without it is skipped; none, or a failing line, is the error', async () => {
  const projects = ['a', 'b', 'c'].map(name => ({ id: name, name, path: `/p/${name}` }) as ProjectSummary)
  const given: unknown[] = []
  const answers: Record<string, { ok: true } | { ok: false; error: string; noHook?: true }> = { '/p/a': { ok: true }, '/p/b': { ok: false, error: 'this project has no subagents hook', noHook: true }, '/p/c': { ok: true } }
  const run = async (cwd: string, settings: unknown) => (given.push([cwd, settings]), answers[cwd]!)
  const dirty = { simple: { driver: 'codex', model: 'gpt-5.5' }, hard: { driver: 'pi' }, atOnce: 3, extra: true } as never
  assert.deepEqual(await setSubagentSettings(projects, dirty, run), { ok: true })
  assert.deepEqual(given, [
    ['/p/a', { simple: { driver: 'codex', model: 'gpt-5.5' }, atOnce: 3 }],
    ['/p/b', { simple: { driver: 'codex', model: 'gpt-5.5' }, atOnce: 3 }],
    ['/p/c', { simple: { driver: 'codex', model: 'gpt-5.5' }, atOnce: 3 }],
  ])
  assert.deepEqual(await setSubagentSettings([projects[1]!], {}, run), { ok: false, error: 'no project has a subagents hook in .the-framework/hooks.yml' })
  answers['/p/c'] = { ok: false, error: 'the subagents hook: boom' }
  assert.deepEqual(await setSubagentSettings(projects, {}, run), { ok: false, error: 'c: the subagents hook: boom' })
})
