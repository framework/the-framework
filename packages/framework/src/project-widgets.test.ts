import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readProjectWidgets, runWidgetCommand, widgetFile, findProjectWidget } from './project-widgets.js'

async function tempDir(prefix: string): Promise<string> {
  return realpath(await mkdtemp(join(tmpdir(), prefix)))
}

/** A package on disk: its package.json, plus any files by relative path. */
async function pkg(dir: string, manifest: Record<string, unknown>, files: Record<string, string> = {}): Promise<void> {
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'package.json'), JSON.stringify(manifest))
  for (const [rel, body] of Object.entries(files)) {
    await mkdir(join(dir, rel, '..'), { recursive: true })
    await writeFile(join(dir, rel), body)
  }
}

test('a project\'s widgets are the dependencies whose package exports ./dashboard to a file inside it', async () => {
  const root = await tempDir('framework-widgets-')
  const elsewhere = await tempDir('framework-widgets-linked-')
  try {
    await pkg(root, {
      dependencies: { '@acme/logs': '1', plain: '1', missing: '1', escapes: '1', 'no-file': '1' },
      devDependencies: { linked: '1', conditional: '1' },
    })
    const modules = join(root, 'node_modules')
    await pkg(join(modules, '@acme/logs'), { name: '@acme/logs', version: '1.2.3', exports: { '.': './index.js', './dashboard': './dist/dashboard.js' }, bin: { logs: 'bin/logs' } }, { 'dist/dashboard.js': 'export default {}' })
    // No widget: a package without the export, one not installed, one whose export leaves the package, one whose file is absent.
    await pkg(join(modules, 'plain'), { name: 'plain', exports: { '.': './index.js' } })
    await pkg(join(modules, 'escapes'), { name: 'escapes', exports: { './dashboard': '../plain/package.json' } })
    await pkg(join(modules, 'no-file'), { name: 'no-file', exports: { './dashboard': './dist/dashboard.js' } })
    // A workspace link reads like an install; a conditional export is read through its browser/import/default target.
    await pkg(elsewhere, { name: 'linked', bin: './cli.js', exports: { './dashboard': './w/index.js' } }, { 'w/index.js': 'export default {}' })
    await symlink(elsewhere, join(modules, 'linked'))
    await pkg(join(modules, 'conditional'), { name: 'conditional', exports: { './dashboard': { types: './d.ts', import: './esm/w.js' } } }, { 'esm/w.js': 'export default {}' })

    const widgets = await readProjectWidgets(root)
    assert.deepEqual(
      widgets.map(w => ({ package: w.package, entry: w.entry, bins: Object.keys(w.bins) })),
      [
        { package: '@acme/logs', entry: 'dashboard.js', bins: ['logs'] },
        { package: 'conditional', entry: 'w.js', bins: [] },
        { package: 'linked', entry: 'index.js', bins: ['linked'] },
      ],
    )
    assert.equal(widgets[0]!.version, '1.2.3')
    assert.equal(widgets[0]!.dir, join(modules, '@acme/logs', 'dist'))
    assert.equal(widgets[2]!.dir, join(elsewhere, 'w'), 'the link is followed to the package itself')

    // A project with no package.json brings none.
    assert.deepEqual(await readProjectWidgets(join(root, 'node_modules')), [])
  } finally {
    await rm(root, { recursive: true, force: true })
    await rm(elsewhere, { recursive: true, force: true })
  }
})

test('a widget serves only the files inside its module\'s own directory', async () => {
  const root = await tempDir('framework-widget-files-')
  try {
    await pkg(root, { dependencies: { w: '1' } })
    const dir = join(root, 'node_modules', 'w')
    await pkg(dir, { name: 'w', exports: { './dashboard': './dist/dashboard.js' } }, { 'dist/dashboard.js': 'x', 'dist/dashboard.css': 'y', 'dist/chunks/a.js': 'z', 'secret.txt': 's' })
    await symlink(join(dir, 'secret.txt'), join(dir, 'dist', 'sneaky.txt'))
    const widget = (await findProjectWidget(root, 'w'))!

    assert.equal(await widgetFile(widget, 'dashboard.css'), join(dir, 'dist', 'dashboard.css'))
    assert.equal(await widgetFile(widget, 'chunks/a.js'), join(dir, 'dist', 'chunks', 'a.js'))
    for (const outside of ['../secret.txt', '../package.json', '../../../package.json', 'sneaky.txt', 'chunks', '', 'nope.js'])
      assert.equal(await widgetFile(widget, outside), undefined, `${JSON.stringify(outside)} is not served`)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a widget runs its own package\'s command in the project and gets its JSON, or the reason it has none', async () => {
  const root = await tempDir('framework-widget-command-')
  try {
    await pkg(root, { dependencies: { one: '1', two: '1' } })
    const script = (body: string) => `#!/usr/bin/env node\n${body}\n`
    await pkg(join(root, 'node_modules', 'one'), { name: 'one', bin: { one: 'bin/one' }, exports: { './dashboard': './w.js' } }, {
      'w.js': 'export default {}',
      'bin/one': script(`
const args = process.argv.slice(2)
if (args[0] === 'fail') { console.error('first line'); console.error('refused: no such run'); process.exit(1) }
if (args[0] === 'words') { console.log('not json'); process.exit(0) }
console.log(JSON.stringify({ args, cwd: process.cwd() }))`),
    })
    await pkg(join(root, 'node_modules', 'two'), { name: 'two', bin: { a: 'bin/a', b: 'bin/b' }, exports: { './dashboard': './w.js' } }, {
      'w.js': 'export default {}',
      'bin/a': script('console.log(JSON.stringify("a"))'),
      'bin/b': script('console.log(JSON.stringify("b"))'),
    })
    const one = (await findProjectWidget(root, 'one'))!
    const two = (await findProjectWidget(root, 'two'))!

    assert.deepEqual(await runWidgetCommand(root, one, ['--limit', '5']), { ok: true, output: { args: ['--limit', '5'], cwd: root } })
    assert.deepEqual(await runWidgetCommand(root, one, ['fail']), { ok: false, error: 'refused: no such run' })
    assert.deepEqual(await runWidgetCommand(root, one, ['words']), { ok: false, error: 'one printed no JSON' })
    assert.deepEqual(await runWidgetCommand(root, one, [], 'other'), { ok: false, error: 'one has no command other' })
    assert.deepEqual(await runWidgetCommand(root, one, Array.from({ length: 40 }, () => 'x')), { ok: false, error: 'too many or too long arguments' })
    // A package with several commands must name one; named, it runs that one.
    assert.deepEqual(await runWidgetCommand(root, two, []), { ok: false, error: 'two has several commands; name one' })
    assert.deepEqual(await runWidgetCommand(root, two, [], 'b'), { ok: true, output: 'b' })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
