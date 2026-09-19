import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { addProject, projectId } from '../registry.js'
import { onWidgets, runWidgetCommand } from './widgets.js'

/** A project with a package.json and installed packages, each `{ exports, bin }` plus files. */
async function project(dir: string, packages: Record<string, { manifest: Record<string, unknown>; files?: Record<string, string> }>): Promise<void> {
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'package.json'), JSON.stringify({ dependencies: Object.fromEntries(Object.keys(packages).map(name => [name, '1'])) }))
  for (const [name, { manifest, files = {} }] of Object.entries(packages)) {
    const pkgDir = join(dir, 'node_modules', name)
    await mkdir(pkgDir, { recursive: true })
    await writeFile(join(pkgDir, 'package.json'), JSON.stringify({ name, ...manifest }))
    for (const [rel, body] of Object.entries(files)) {
      await mkdir(join(pkgDir, rel, '..'), { recursive: true })
      await writeFile(join(pkgDir, rel), body)
    }
  }
}

const widget = (bin: string) => ({
  manifest: { exports: { './dashboard': './w.js' }, bin: { [bin]: `bin/${bin}` } },
  files: { 'w.js': 'export default {}', [`bin/${bin}`]: `console.log(JSON.stringify(${JSON.stringify(bin)}))` },
})

test('the dashboard\'s widgets are every registered project\'s, one per package, and a widget runs only its own package\'s commands', async () => {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'framework-widgets-rpc-')))
  const previous = process.env.XDG_CONFIG_HOME
  process.env.XDG_CONFIG_HOME = join(dir, 'cfg')
  try {
    await mkdir(process.env.XDG_CONFIG_HOME, { recursive: true })
    const a = join(dir, 'a')
    const b = join(dir, 'b')
    await project(a, { logs: widget('logs'), plain: { manifest: { bin: { plain: 'bin/plain' } }, files: { 'bin/plain': 'console.log("1")' } } })
    await project(b, { logs: widget('logs'), queue: widget('queue') })
    await addProject(a, '2026-09-19T00:00:00.000Z')
    await addProject(b, '2026-09-19T00:00:01.000Z')

    assert.deepEqual(await onWidgets(), [
      { package: 'logs', url: `/_widgets/${projectId(a)}/logs/w.js`, projects: [projectId(a), projectId(b)] },
      { package: 'queue', url: `/_widgets/${projectId(b)}/queue/w.js`, projects: [projectId(b)] },
    ])

    assert.deepEqual(await runWidgetCommand(projectId(b), 'queue', []), { ok: true, output: 'queue' })
    // A package the project has but that brings no widget, a widget of another project, an unknown project: refused.
    assert.deepEqual(await runWidgetCommand(projectId(a), 'plain', []), { ok: false, error: 'plain brings no widget to this project' })
    assert.deepEqual(await runWidgetCommand(projectId(a), 'queue', []), { ok: false, error: 'queue brings no widget to this project' })
    assert.deepEqual(await runWidgetCommand('nowhere-1', 'logs', []), { ok: false, error: 'unknown project' })
  } finally {
    if (previous === undefined) delete process.env.XDG_CONFIG_HOME
    else process.env.XDG_CONFIG_HOME = previous
    await rm(dir, { recursive: true, force: true })
  }
})
